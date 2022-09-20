# Remix Auth Shield

## Goals

- handle type narrowing
- support async and sync
- easy error message handling
- consistent with rule failure and messages

---

```ts
export let loader: LoaderFunction = async (args: LoaderArgs) => {
	//
	let user = await authorizer.authorize(args, {
		rules: [
			async function isNotAdmin({ user }) {
				return user.role !== "admin";
			},
		],
	});
	// At this point we know the user is authorized based on the global rules and the route specific rule applied above
	return json({});
};
```
