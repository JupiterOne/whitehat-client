const WhitehatClient = require("./WhitehatClient");

const client = new WhitehatClient("fake-whitehat-api-key");

describe("#getUrl", async () => {
  test("no options", async () => {
    const expectedUrl = client.whBaseUrl + "/application?key=fake-whitehat-api-key";
    const url = client.getUrl();
    expect(url).toBe(expectedUrl);
  });

  test("all options", async () => {
    const expectedUrl = client.whBaseUrl + "/application/123/vuln?key=fake-whitehat-api-key&display_all=1";
    const url = client.getUrl({
      appId: 123,
      additionalPathPart: "vuln",
      queryParams: ["display_all=1"],
    });
    expect(url).toBe(expectedUrl);
  });

  test("different base", async () => {
    const expectedUrl = client.whBaseUrl + "/source_vuln?key=fake-whitehat-api-key";
    const url = client.getUrl({
      base: "source_vuln",
    });
    expect(url).toBe(expectedUrl);
  });
});
