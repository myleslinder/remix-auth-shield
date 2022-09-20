import { RuleFunction, RuleGuard } from "~/index";

function or<TUser, TData>(
	...rules: RuleFunction<TUser, TData>[]
): RuleFunction<TUser, TData> {
	return async (user, ctx) => {
		const results = await Promise.all(
			rules.map(async (rule) => {
				return rule(user, ctx);
			}),
		);
		return results.length > 0 ? results.some(Boolean) : true;
	};
}

function not<TUser, TData>(
	rule: RuleFunction<TUser, TData>,
): RuleFunction<TUser, TData> {
	return async (user, ctx) => {
		const outcome = await rule(user, ctx);
		return !outcome;
	};
}
function notType<TUser, TNarrowedUser extends TUser>(
	rule: RuleGuard<TUser, TNarrowedUser>["rule"],
): RuleGuard<TUser, Exclude<TUser, TNarrowedUser>>["rule"] {
	return function (user): user is Exclude<TUser, TNarrowedUser> {
		const outcome = rule(user);
		return !outcome;
	};
}
function andType<TUser, TNarrowedUser extends TUser>(
	...rules: RuleGuard<TUser, TNarrowedUser>["rule"][]
): RuleGuard<TUser, Extract<TUser, TNarrowedUser>>["rule"] {
	return function (user): user is Extract<TUser, TNarrowedUser> {
		const outcomes = rules.reverse().map((r) => r(user));
		return outcomes.every(Boolean);
	};
}

export { or, not, notType, andType };
