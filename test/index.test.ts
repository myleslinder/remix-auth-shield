import { describe, expect, it } from "vitest";

import { createCookieSessionStorage } from "@remix-run/node";
import { LoaderArgs } from "@remix-run/server-runtime";
import { Authenticator } from "remix-auth";
import { not, notType, or, Shield } from "~/index";

type ActionRole = "editor" | "readonly";

type SigningUpUser = {
	email: string;
	onboarding: true;
};

type OnboardedUser = Admin | RegularUser;

type NonAdminUser = RegularUser | SigningUpUser;

type Admin = {
	id: string;
	email: string;
	onboarding: false;
	action: ActionRole;
	role: "admin";
};
type RegularUser = {
	id: string;
	email: string;
	onboarding: false;
	action: ActionRole;
	role: "user";
};
type Editor = OnboardedUser & {
	action: "editor";
};
type User = OnboardedUser | SigningUpUser;
type AdminEditor = Admin & Editor;

const sessionStorage = createCookieSessionStorage({
	cookie: { secrets: ["s3cr3t"] },
});

const authenticator = new Authenticator<User>(sessionStorage);

const shield = new Shield(authenticator, sessionStorage);

function isAdmin(u: User): u is Admin {
	return !isUserSignUp(u) && u.role === "admin";
}
function isUserSignUp(u: User): u is SigningUpUser {
	return u.onboarding;
}
function isNotAdmin(u: User): u is NonAdminUser {
	return isUserSignUp(u) || u.role !== "admin";
}
function isEditor(u: User): u is Editor {
	return !u.onboarding && u.action === "editor";
}
function isAdminEditor(u: User): u is AdminEditor {
	return isAdmin(u) && isEditor(u);
}

const notAdminGuard = {
	message: "must be an admin",
	failureRedirect: "/entry",
	rule: notType(isNotAdmin),
};

export const loader = async ({ request }: LoaderArgs) => {
	const user = await shield.authorize(request, {
		raise: "redirect",
		failureRedirect: "",
		guards: [
			notAdminGuard,
			{
				message: "2",
				failureRedirect: "",
				rule: notType(isUserSignUp),
			},
			{
				message: "must be admin",
				failureRedirect: "",
				rule: isAdmin,
			},
		],
		rules: [
			{
				message: "",
				rule: () => false,
			},
			isEditor,
			or(
				isAdmin,
				not(async () => true),
			),
			isAdminEditor,
		],
	});
};

export type { User, Admin };

describe("should", () => {
	it("exported", () => {
		expect(1).toEqual(1);
	});
});
