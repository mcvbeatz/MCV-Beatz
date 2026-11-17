export const BASE_FORMS = ["fire", "water", "earth", "air", "light", "dark"];
const key = (id) => `fusion-throwdown:player:v1:${id || "guest"}`;
export function defaultElement(user = null, storage) {
  const remote = user?.user_metadata?.default_element;
  if (BASE_FORMS.includes(remote)) return remote;
  try {
    storage ??= globalThis.localStorage;
    const value = JSON.parse(storage?.getItem(key(user?.id)) || "{}").element;
    return BASE_FORMS.includes(value) ? value : "fire";
  } catch {
    return "fire";
  }
}
export async function saveDefaultElement(element, account, storage) {
  if (!BASE_FORMS.includes(element))
    throw new Error("Choose a base elemental.");
  if (account.user) {
    const { error } = await account
      .require()
      .auth.updateUser({ data: { default_element: element } });
    if (error) throw error;
    account.user.user_metadata = {
      ...account.user.user_metadata,
      default_element: element,
    };
  }
  storage ??= globalThis.localStorage;
  storage?.setItem(key(account.user?.id), JSON.stringify({ element }));
}
