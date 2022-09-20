import type {
	DataFunctionArgs,
	Session,
	SessionStorage,
} from "@remix-run/server-runtime";
import { json, redirect } from "@remix-run/server-runtime";
import { Authenticator, AuthorizationError } from "remix-auth";

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
	k: infer I,
) => void
	? I
	: never;

export type RuleContext<TData = null> = {
	data?: TData;
	session: Session;
} & DataFunctionArgs;

export type RuleGuard<TUser, TNarrowedUser extends TUser> = {
	message: string;
	failureRedirect?: string;
	rule(value: TUser): value is TNarrowedUser;
};

export type RuleFunction<TUser, TData = null> = (
	user: TUser,
	context: RuleContext<TData>,
) => Promise<boolean> | boolean;

export type Rule<TUser, TData = null> =
	| {
			message: string;
			failureRedirect?: string;
			rule: RuleFunction<TUser, TData>;
	  }
	| RuleFunction<TUser, TData>;

type AuthorizeOptions<TUser, TGuards, TData> = (
	| {
			failureRedirect?: never;
			raise: "error" | "response";
	  }
	| {
			failureRedirect: string;
			raise: "redirect";
	  }
	| {
			failureRedirect?: never;
			raise?: never;
	  }
) & {
	rules?: Rule<TUser, TData>[];
	guards?: TGuards[];
	params?: DataFunctionArgs["params"];
	context?: DataFunctionArgs["context"];
};

class Shield<TUser = unknown, TData = unknown> {
	constructor(
		private authenticator: Authenticator<TUser>,
		private sessionStorage: SessionStorage,
		private rules: Rule<TUser, TData>[] = [],
	) {}

	async authorize<
		TInnerData extends TData,
		TType extends TUser,
		TMessage extends string,
		TGuards extends {
			message: TMessage;
			failureRedirect?: string;
			rule(value: TUser): value is TType;
		},
	>(
		request: Request,
		{
			failureRedirect,
			raise,
			params,
			context,
			rules = [],
			guards = [],
		}: AuthorizeOptions<TUser, TGuards, TInnerData> = {
			raise: "response",
			rules: [],
			guards: [],
		},
	) {
		if (!raise) raise = "response";
		const session = await this.getSession(request);
		const user = await this.authenticator.isAuthenticated(session);
		const baseMessage = "Not authenticated.";
		if (!user) {
			if (raise === "response") {
				throw json({ message: baseMessage }, { status: 401 });
			}
			if (raise === "redirect") {
				throw this.failure(session, { message: baseMessage, failureRedirect });
			}
			throw new AuthorizationError("Not authenticated.");
		}
		const narrowedUser = await this.guard(session, user, guards);

		for (const rule of [...this.rules, ...rules]) {
			const callableRule = typeof rule === "function" ? rule : rule.rule;
			const message =
				typeof rule === "function"
					? `Forbidden${rule.name ? ` by policy ${rule.name}` : ""}`
					: rule.message;
			const outcome = callableRule(user, {
				request,
				session,
				params: params ?? {},
				context: context ?? {},
			});
			if (outcome instanceof Promise ? await outcome : outcome) continue;
			if (raise === "redirect") {
				throw this.failure(session, { message, failureRedirect });
			}
			if (raise === "response") {
				throw json({ message }, { status: 403 });
			}
			throw new AuthorizationError(message);
		}
		return narrowedUser;
	}

	private async guard<
		TType extends TUser,
		// has the messages as a generic because it works on the assumption that the messages are unique
		TMessage extends string,
		Guards extends {
			message: TMessage;
			failureRedirect?: string;
			rule(value: TType): value is any;
		},
	>(
		session: Session,
		initial: TType,
		// has to be an array because it wasn't picking up the definitions correctly otherwise
		rules: Guards[],
	): Promise<
		UnionToIntersection<
			//loops through the rules one by one
			Guards extends unknown
				? // for each rule, returns an array with the type it allows as [T]
				  Guards extends { rule(v: TUser): v is infer V extends TUser }
					? [V]
					: never
				: never
		> extends infer GuardsResult extends [unknown] // joins together all the rule types as [T1] & [T1 | T2] & ...
			? // gets the value at index 0
			  GuardsResult[0]
			: never
	>;
	private async guard(
		session: Session,
		user: unknown,
		rules: RuleGuard<unknown, any>[],
	) {
		for (const { rule, message, failureRedirect } of rules) {
			const outcome = rule(user);
			if (!outcome) {
				if (failureRedirect) {
					this.failure(session, { message, failureRedirect });
				}
				throw new AuthorizationError(message);
			}
		}
		return user;
	}

	private async failure(
		session: Session,
		{ message, failureRedirect }: { message: string; failureRedirect: string },
	) {
		session.flash(this.authenticator.sessionErrorKey, { message });
		return redirect(failureRedirect, {
			headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
		});
	}

	private getSession(request: Request) {
		return this.sessionStorage.getSession(request.headers.get("Cookie"));
	}
}

export * from "./logic-rules";
export { Shield };
