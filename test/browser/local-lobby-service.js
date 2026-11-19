import { createLobbyServer } from "../../server/index.js";
export function installLobbyService(test) {
  let service;
  test.beforeAll(async () => {
    service = createLobbyServer({
      verifyUser: async (id) => ({ id, user_metadata: { username: id } }),
    });
    await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
  });
  test.afterAll(async () => service.close());
  return async (page) =>
    page.route("**/app-config.json", (r) =>
      r.fulfill({
        json: {
          multiplayerUrl: `ws://127.0.0.1:${service.server.address().port}`,
        },
      }),
    );
}
export async function signedTestAccount(page, id = "test-player") {
  await page.evaluate((id) => {
    __app.account.user = { id, user_metadata: { username: id } };
    __app.account.client = {
      auth: {
        getSession: async () => ({ data: { session: { access_token: id } } }),
      },
      rpc: async () => ({ error: null }),
      from: () => {
        throw Error("Local test: cloud unavailable");
      },
    };
  }, id);
}
