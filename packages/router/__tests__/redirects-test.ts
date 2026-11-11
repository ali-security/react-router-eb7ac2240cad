import {
  IDLE_NAVIGATION,
  createBrowserHistory,
  createMemoryHistory,
  createRouter,
  redirect,
  redirectDocument,
} from "../index";
import { replace } from "../utils";
import type { TestRouteObject } from "./utils/data-router-setup";
import { cleanup, setup } from "./utils/data-router-setup";
import { createFormData, tick } from "./utils/utils";

describe("redirects", () => {
  afterEach(() => cleanup());

  let REDIRECT_ROUTES: TestRouteObject[] = [
    {
      id: "root",
      path: "/",
      children: [
        {
          id: "parent",
          path: "parent",
          action: true,
          loader: true,
          children: [
            {
              id: "child",
              path: "child",
              action: true,
              loader: true,
              children: [
                {
                  id: "index",
                  index: true,
                  action: true,
                  loader: true,
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  it("applies the basename to redirects returned from loaders", async () => {
    let t = setup({
      routes: REDIRECT_ROUTES,
      basename: "/base/name",
      initialEntries: ["/base/name"],
    });

    let nav1 = await t.navigate("/base/name/parent");

    let nav2 = await nav1.loaders.parent.redirectReturn("/parent/child");
    await nav2.loaders.parent.resolve("PARENT");
    await nav2.loaders.child.resolve("CHILD");
    await nav2.loaders.index.resolve("INDEX");
    expect(t.router.state).toMatchObject({
      historyAction: "PUSH",
      location: {
        pathname: "/base/name/parent/child",
      },
      navigation: IDLE_NAVIGATION,
      loaderData: {
        parent: "PARENT",
        child: "CHILD",
        index: "INDEX",
      },
      errors: null,
    });
    expect(t.history.action).toEqual("PUSH");
    expect(t.history.location.pathname).toEqual("/base/name/parent/child");
  });

  it("supports relative routing in redirects (from parent navigation loader)", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let nav1 = await t.navigate("/parent/child");

    await nav1.loaders.child.resolve("CHILD");
    await nav1.loaders.index.resolve("INDEX");
    await nav1.loaders.parent.redirectReturn("..");
    // No root loader so redirect lands immediately
    expect(t.router.state).toMatchObject({
      location: {
        pathname: "/",
      },
      navigation: IDLE_NAVIGATION,
      loaderData: {},
      errors: null,
    });
  });

  it("supports relative routing in redirects (from child navigation loader)", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let nav1 = await t.navigate("/parent/child");

    await nav1.loaders.parent.resolve("PARENT");
    await nav1.loaders.index.resolve("INDEX");
    let nav2 = await nav1.loaders.child.redirectReturn(
      "..",
      undefined,
      undefined,
      ["parent"]
    );
    await nav2.loaders.parent.resolve("PARENT 2");
    expect(t.router.state).toMatchObject({
      location: {
        pathname: "/parent",
      },
      navigation: IDLE_NAVIGATION,
      loaderData: {
        parent: "PARENT 2",
      },
      errors: null,
    });
  });

  it("supports relative routing in redirects (from index navigation loader)", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let nav1 = await t.navigate("/parent/child");

    await nav1.loaders.parent.resolve("PARENT");
    await nav1.loaders.child.resolve("INDEX");
    let nav2 = await nav1.loaders.index.redirectReturn(
      "..",
      undefined,
      undefined,
      ["parent"]
    );
    await nav2.loaders.parent.resolve("PARENT 2");
    expect(t.router.state).toMatchObject({
      location: {
        pathname: "/parent",
      },
      navigation: IDLE_NAVIGATION,
      loaderData: {
        parent: "PARENT 2",
      },
      errors: null,
    });
  });

  it("supports relative routing in redirects (from parent fetch loader)", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let fetch = await t.fetch("/parent", "key");

    await fetch.loaders.parent.redirectReturn("..", undefined, undefined, [
      "parent",
    ]);

    // No root loader so redirect lands immediately
    expect(t.router.state).toMatchObject({
      location: {
        pathname: "/",
      },
      navigation: IDLE_NAVIGATION,
      loaderData: {},
      errors: null,
    });
    expect(t.router.state.fetchers.get("key")).toMatchObject({
      state: "idle",
      data: undefined,
    });
  });

  it("supports relative routing in redirects (from child fetch loader)", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let fetch = await t.fetch("/parent/child");
    let nav = await fetch.loaders.child.redirectReturn(
      "..",
      undefined,
      undefined,
      ["parent"]
    );

    await nav.loaders.parent.resolve("PARENT");
    expect(t.router.state).toMatchObject({
      location: {
        pathname: "/parent",
      },
      navigation: IDLE_NAVIGATION,
      loaderData: {
        parent: "PARENT",
      },
      errors: null,
    });
  });

  it("supports relative routing in redirects (from index fetch loader)", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let fetch = await t.fetch("/parent/child?index");
    let nav = await fetch.loaders.index.redirectReturn(
      "..",
      undefined,
      undefined,
      ["parent"]
    );

    await nav.loaders.parent.resolve("PARENT");
    expect(t.router.state).toMatchObject({
      location: {
        pathname: "/parent",
      },
      navigation: IDLE_NAVIGATION,
      loaderData: {
        parent: "PARENT",
      },
      errors: null,
    });
  });

  it("supports . redirects", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let nav1 = await t.navigate("/parent");

    let nav2 = await nav1.loaders.parent.redirectReturn(
      "./child",
      undefined,
      undefined,
      ["parent", "child", "index"]
    );
    await nav2.loaders.parent.resolve("PARENT");
    await nav2.loaders.child.resolve("CHILD");
    await nav2.loaders.index.resolve("INDEX");
    expect(t.router.state).toMatchObject({
      location: {
        pathname: "/parent/child",
      },
      navigation: IDLE_NAVIGATION,
      loaderData: {
        parent: "PARENT",
        child: "CHILD",
        index: "INDEX",
      },
      errors: null,
    });
  });

  it("supports relative routing in navigation action redirects", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let nav1 = await t.navigate("/parent/child", {
      formMethod: "post",
      formData: createFormData({}),
    });

    let nav2 = await nav1.actions.child.redirectReturn(
      "..",
      undefined,
      undefined,
      ["parent"]
    );
    await nav2.loaders.parent.resolve("PARENT");
    expect(t.router.state).toMatchObject({
      location: {
        pathname: "/parent",
      },
      navigation: IDLE_NAVIGATION,
      loaderData: {
        parent: "PARENT",
      },
      errors: null,
    });
  });

  it("supports relative routing in fetch action redirects", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let nav1 = await t.fetch("/parent/child", {
      formMethod: "post",
      formData: createFormData({}),
    });

    let nav2 = await nav1.actions.child.redirectReturn(
      "..",
      undefined,
      undefined,
      ["parent"]
    );
    await nav2.loaders.parent.resolve("PARENT");
    expect(t.router.state).toMatchObject({
      location: {
        pathname: "/parent",
      },
      navigation: IDLE_NAVIGATION,
      loaderData: {
        parent: "PARENT",
      },
      errors: null,
    });
  });

  it("preserves query and hash in redirects", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let nav1 = await t.navigate("/parent/child", {
      formMethod: "post",
      formData: createFormData({}),
    });

    let nav2 = await nav1.actions.child.redirectReturn(
      "/parent?key=value#hash"
    );
    await nav2.loaders.parent.resolve("PARENT");
    expect(t.router.state).toMatchObject({
      location: {
        pathname: "/parent",
        search: "?key=value",
        hash: "#hash",
      },
      navigation: IDLE_NAVIGATION,
      loaderData: {
        parent: "PARENT",
      },
      errors: null,
    });
  });

  it("preserves query and hash in relative redirects", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let nav1 = await t.navigate("/parent/child", {
      formMethod: "post",
      formData: createFormData({}),
    });

    let nav2 = await nav1.actions.child.redirectReturn(
      "..?key=value#hash",
      undefined,
      undefined,
      ["parent"]
    );
    await nav2.loaders.parent.resolve("PARENT");
    expect(t.router.state).toMatchObject({
      location: {
        pathname: "/parent",
        search: "?key=value",
        hash: "#hash",
      },
      navigation: IDLE_NAVIGATION,
      loaderData: {
        parent: "PARENT",
      },
      errors: null,
    });
  });

  it("processes external redirects if window is present (push)", async () => {
    let urls = [
      "http://remix.run/blog",
      "https://remix.run/blog",
      "//remix.run/blog",
      "app://whatever",
    ];

    for (let url of urls) {
      let t = setup({ routes: REDIRECT_ROUTES });

      let A = await t.navigate("/parent/child", {
        formMethod: "post",
        formData: createFormData({}),
      });

      await A.actions.child.redirectReturn(url);
      expect(t.window.location.assign).toHaveBeenCalledWith(url);
      expect(t.window.location.replace).not.toHaveBeenCalled();
    }
  });

  it("processes external redirects if window is present (replace)", async () => {
    let urls = [
      "http://remix.run/blog",
      "https://remix.run/blog",
      "//remix.run/blog",
      "app://whatever",
    ];

    for (let url of urls) {
      let t = setup({ routes: REDIRECT_ROUTES });

      let A = await t.navigate("/parent/child", {
        formMethod: "post",
        formData: createFormData({}),
        replace: true,
      });

      await A.actions.child.redirectReturn(url);
      expect(t.window.location.replace).toHaveBeenCalledWith(url);
      expect(t.window.location.assign).not.toHaveBeenCalled();
    }
  });

  it("processes redirects with document reload if header is present (assign)", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let A = await t.navigate("/parent/child", {
      formMethod: "post",
      formData: createFormData({}),
    });

    await A.actions.child.redirectReturn("/redirect", 301, {
      "X-Remix-Reload-Document": "true",
    });
    expect(t.window.location.assign).toHaveBeenCalledWith("/redirect");
    expect(t.window.location.replace).not.toHaveBeenCalled();
  });

  it("processes redirects with document reload if header is present (replace)", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let A = await t.navigate("/parent/child", {
      formMethod: "post",
      formData: createFormData({}),
      replace: true,
    });

    await A.actions.child.redirectReturn("/redirect", 301, {
      "X-Remix-Reload-Document": "true",
    });
    expect(t.window.location.replace).toHaveBeenCalledWith("/redirect");
    expect(t.window.location.assign).not.toHaveBeenCalled();
  });

  it("properly handles same-origin absolute URLs", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let A = await t.navigate("/parent/child", {
      formMethod: "post",
      formData: createFormData({}),
    });

    let B = await A.actions.child.redirectReturn(
      "http://localhost/parent",
      undefined,
      undefined,
      ["parent"]
    );
    await B.loaders.parent.resolve("PARENT");
    expect(t.router.state.location).toMatchObject({
      hash: "",
      pathname: "/parent",
      search: "",
      state: {
        _isRedirect: true,
      },
    });
  });

  it("properly handles same-origin absolute URLs when using a basename", async () => {
    let t = setup({ routes: REDIRECT_ROUTES, basename: "/base" });

    let A = await t.navigate("/base/parent/child", {
      formMethod: "post",
      formData: createFormData({}),
    });

    let B = await A.actions.child.redirectReturn(
      "http://localhost/base/parent",
      undefined,
      undefined,
      ["parent"]
    );
    await B.loaders.parent.resolve("PARENT");
    expect(t.router.state.location).toMatchObject({
      hash: "",
      pathname: "/base/parent",
      search: "",
      state: {
        _isRedirect: true,
      },
    });
  });

  it("treats same-origin absolute URLs as external if they don't match the basename", async () => {
    let t = setup({ routes: REDIRECT_ROUTES, basename: "/base" });

    let A = await t.navigate("/base/parent/child", {
      formMethod: "post",
      formData: createFormData({}),
    });

    let url = "http://localhost/not/the/same/basename";
    await A.actions.child.redirectReturn(url);
    expect(t.window.location.assign).toHaveBeenCalledWith(url);
    expect(t.window.location.replace).not.toHaveBeenCalled();
  });

  describe("same-origin absolute URLs with double slashes", () => {
    // The pathname of a same-origin absolute URL such as
    // `http://localhost//evil.com/path` is `//evil.com/path`, which would be a
    // protocol-relative (cross-origin) URL if it were used as-is once the
    // origin has been stripped off
    let DOUBLE_SLASH_ROUTES: TestRouteObject[] = [
      {
        id: "root",
        path: "/",
        children: [
          {
            id: "parent",
            path: "parent",
            action: true,
            loader: true,
          },
          {
            id: "evil",
            path: "evil.com/path",
          },
        ],
      },
    ];

    let DOUBLE_SLASH_REDIRECTS: [string, string][] = [
      ["http://localhost//evil.com/path", "/evil.com/path"],
      ["http://localhost///evil.com/path", "/evil.com/path"],
      ["http://localhost/\\evil.com/path", "/evil.com/path"],
      ["//localhost//evil.com/path", "/evil.com/path"],
      ["http://localhost//evil.com/path?a=1#hash", "/evil.com/path?a=1#hash"],
    ];

    // Where the redirect originates: a navigation loader, a navigation action
    // (with and without an explicit `replace`), or a fetcher loader/action
    let DOUBLE_SLASH_SOURCES = [
      "loader",
      "action",
      "action (replace)",
      "fetcher loader",
      "fetcher action",
    ];

    async function startDoubleSlashRedirect(source: string, url: string) {
      let t = setup({ routes: DOUBLE_SLASH_ROUTES });
      if (source === "loader") {
        let A = await t.navigate("/parent");
        await A.loaders.parent.redirectReturn(url);
      } else if (source === "action" || source === "action (replace)") {
        let A = await t.navigate("/parent", {
          formMethod: "post",
          formData: createFormData({}),
          replace: source === "action (replace)" ? true : undefined,
        });
        await A.actions.parent.redirectReturn(url);
      } else if (source === "fetcher loader") {
        let A = await t.fetch("/parent");
        await A.loaders.parent.redirectReturn(url);
      } else {
        let A = await t.fetch("/parent", {
          formMethod: "post",
          formData: createFormData({}),
        });
        await A.actions.parent.redirectReturn(url);
      }
      return t;
    }

    let cases: [string, string, string][] = [];
    DOUBLE_SLASH_SOURCES.forEach((source) =>
      DOUBLE_SLASH_REDIRECTS.forEach(([url, expected]) =>
        cases.push([source, url, expected])
      )
    );

    it.each(cases)(
      "normalizes %s redirects to %j as an in-app navigation to %j",
      async (source, url, expected) => {
        let t = await startDoubleSlashRedirect(source, url);
        let hrefs = [
          ...(t.window.location.assign as jest.Mock).mock.calls,
          ...(t.window.location.replace as jest.Mock).mock.calls,
          ...(t.history.push as jest.Mock).mock.calls,
          ...(t.history.replace as jest.Mock).mock.calls,
        ].map((args) => t.history.createHref(args[0]));
        expect(hrefs).toEqual([expected]);
        expect(t.window.location.assign).not.toHaveBeenCalled();
        expect(t.window.location.replace).not.toHaveBeenCalled();
        let expectedUrl = new URL(expected, "http://localhost");
        expect(t.router.state).toMatchObject({
          historyAction: source === "action (replace)" ? "REPLACE" : "PUSH",
          location: {
            pathname: "/evil.com/path",
            search: expectedUrl.search,
            hash: expectedUrl.hash,
            state: {
              _isRedirect: true,
            },
          },
          navigation: IDLE_NAVIGATION,
          errors: null,
        });
      }
    );

    it("normalizes double slashes in same-origin absolute document redirects", async () => {
      for (let replace of [false, true]) {
        let t = setup({ routes: DOUBLE_SLASH_ROUTES });

        let A = await t.navigate("/parent", {
          formMethod: "post",
          formData: createFormData({}),
          replace,
        });
        await A.actions.parent.redirectReturn(
          "http://localhost//evil.com/path?a=1#hash",
          undefined,
          { "X-Remix-Reload-Document": "true" }
        );
        let [called, notCalled] = replace
          ? [t.window.location.replace, t.window.location.assign]
          : [t.window.location.assign, t.window.location.replace];
        expect(called).toHaveBeenCalledWith("/evil.com/path?a=1#hash");
        expect(notCalled).not.toHaveBeenCalled();
      }
    });
  });

  it("automatically replaces in the history stack if you redirect to the same location (root relative)", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let A = await t.navigate("/parent");
    await A.loaders.parent.resolve("PARENT");

    let B = await t.navigate("/parent", {
      formMethod: "post",
      formData: createFormData({}),
    });
    let C = await B.actions.parent.redirectReturn("/parent");
    await C.loaders.parent.resolve("PARENT*");

    expect(t.router.state.location).toMatchObject({ pathname: "/parent" });

    // Because we redirected to the current location it defaults to a replace
    await t.router.navigate(-1);
    expect(t.router.state.location).toMatchObject({ pathname: "/" });
  });

  it("automatically replaces in the history stack if you redirect to the same location (absolute)", async () => {
    let t = setup({ routes: REDIRECT_ROUTES });

    let A = await t.navigate("/parent");
    await A.loaders.parent.resolve("PARENT");

    let B = await t.navigate("/parent", {
      formMethod: "post",
      formData: createFormData({}),
    });
    let C = await B.actions.parent.redirectReturn(
      "http://localhost/parent",
      undefined,
      undefined,
      ["parent"]
    );
    await C.loaders.parent.resolve("PARENT*");

    expect(t.router.state.location).toMatchObject({ pathname: "/parent" });

    // Because we redirected to the current location it defaults to a replace
    await t.router.navigate(-1);
    expect(t.router.state.location).toMatchObject({ pathname: "/" });
  });

  it("preserves action revalidation across multiple redirects", async () => {
    let t = setup({
      initialEntries: ["/action"],
      routes: [
        {
          id: "action",
          path: "/action",
          loader: true,
          children: [
            {
              id: "index",
              index: true,
              action: true,
              loader: true,
            },
            {
              id: "one",
              path: "1",
              loader: true,
            },
            {
              path: "2",
            },
          ],
        },
      ],
      hydrationData: {
        loaderData: {
          action: "ACTION 0",
          index: "INDEX",
        },
      },
    });

    let A = await t.navigate("/action?index", {
      formMethod: "post",
      formData: createFormData({}),
    });

    let B = await A.actions.index.redirectReturn("/action/1");
    await B.loaders.action.resolve("ACTION 1");
    let C = await B.loaders.one.redirectReturn("/action/2");
    await C.loaders.action.resolve("ACTION 2");

    expect(t.router.state).toMatchObject({
      location: {
        pathname: "/action/2",
      },
      navigation: IDLE_NAVIGATION,
      loaderData: {
        action: "ACTION 2",
      },
    });
  });

  it("preserves X-Remix-Revalidate revalidation across multiple redirects", async () => {
    let t = setup({
      initialEntries: ["/loader"],
      routes: [
        {
          id: "loader",
          path: "/loader",
          loader: true,
          children: [
            {
              id: "index",
              index: true,
            },
            {
              id: "one",
              path: "1",
              loader: true,
            },
            {
              id: "two",
              path: "2",
              loader: true,
            },
            {
              path: "3",
            },
          ],
        },
      ],
      hydrationData: {
        loaderData: {
          loader: "LOADER 0",
        },
      },
    });

    let A = await t.navigate("/loader/1");
    let B = await A.loaders.one.redirectReturn("/loader/2", undefined, {
      "X-Remix-Revalidate": "true",
    });
    await B.loaders.loader.resolve("LOADER 3");
    let C = await B.loaders.two.redirectReturn("/loader/3");
    await C.loaders.loader.resolve("LOADER 3");

    expect(t.router.state).toMatchObject({
      location: {
        pathname: "/loader/3",
      },
      navigation: IDLE_NAVIGATION,
      loaderData: {
        loader: "LOADER 3",
      },
    });
  });

  it("supports replace() redirects", async () => {
    let router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: "/",
        },
        {
          path: "/a",
        },
        {
          path: "/b",
          loader: () => replace("/c"),
        },
        {
          path: "/c",
        },
      ],
    });
    router.initialize();
    await tick();

    // ['/']
    expect(router.state).toMatchObject({
      historyAction: "POP",
      location: {
        pathname: "/",
        state: null,
      },
    });

    // Push /a: ['/', '/a']
    await router.navigate("/a");
    expect(router.state).toMatchObject({
      historyAction: "PUSH",
      location: {
        pathname: "/a",
        state: null,
      },
    });

    // Push /b which calls replace('/c'): ['/', '/c']
    await router.navigate("/b");
    expect(router.state).toMatchObject({
      historyAction: "REPLACE",
      location: {
        pathname: "/c",
        state: {
          _isRedirect: true,
        },
      },
    });

    // Pop: ['/']
    await router.navigate(-1);
    expect(router.state).toMatchObject({
      historyAction: "POP",
      location: {
        pathname: "/",
        state: null,
      },
    });
  });

  describe("invalid redirect locations", () => {
    let INVALID_REDIRECTS = [
      // eslint-disable-next-line no-script-url
      "javascript:alert(1)",
      // eslint-disable-next-line no-script-url
      "JavaScript:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
      "blob:http://localhost/2e5f1b5e-6b4c-4e7e-8f43-0a5e1c3d9b11",
      "file:///etc/passwd",
      "about:blank",
      "chrome://settings",
      "filesystem:http://localhost/temporary/evil.html",
    ];

    // The URL parser removes ASCII tab characters anywhere in the input, so
    // these don't look like absolute URLs to ABSOLUTE_URL_REGEX but a browser
    // would still treat them as `javascript:` URLs if handed over as-is
    let OBFUSCATED_REDIRECTS = [
      "java\tscript:alert(1)",
      "j\ta\tv\ta\ts\tc\tr\ti\tp\tt:alert(1)",
    ];

    function setupRedirectRouter(getResponse: () => Response) {
      // Inject a jest-friendly window so we can assert the redirect location
      // never reaches window.location.assign/replace
      let testWindow = {
        ...window,
        location: {
          ...window.location,
          assign: jest.fn(),
          replace: jest.fn(),
        },
      } as unknown as Window;
      let history = createMemoryHistory();
      jest.spyOn(history, "push");
      jest.spyOn(history, "replace");
      let router = createRouter({
        history,
        window: testWindow,
        routes: [
          { path: "/" },
          { path: "/target" },
          {
            path: "/redirect",
            loader: () => getResponse(),
            action: () => getResponse(),
          },
        ],
      }).initialize();
      return { router, history, window: testWindow };
    }

    // Where the redirect originates: a navigation loader, a navigation action
    // (with and without an explicit `replace`), or a loader returning a
    // `redirectDocument()` which goes straight to window.location
    let REDIRECT_SOURCES = ["loader", "action", "action (replace)", "document"];

    function startInvalidRedirect(source: string, url: string) {
      let t = setupRedirectRouter(() =>
        source === "document" ? redirectDocument(url) : redirect(url)
      );
      let promise =
        source === "loader" || source === "document"
          ? t.router.navigate("/redirect")
          : t.router.navigate("/redirect", {
              formMethod: "post",
              formData: createFormData({}),
              replace: source === "action (replace)" ? true : undefined,
            });
      return { t, promise };
    }

    function getCases(urls: string[]) {
      let cases: [string, string][] = [];
      REDIRECT_SOURCES.forEach((source) =>
        urls.forEach((url) => cases.push([source, url]))
      );
      return cases;
    }

    it.each(getCases(INVALID_REDIRECTS))(
      "rejects %s redirects to invalid protocol %j",
      async (source, url) => {
        let { t, promise } = startInvalidRedirect(source, url);
        await expect(promise).rejects.toThrow("Invalid redirect location");
        expect(t.window.location.assign).not.toHaveBeenCalled();
        expect(t.window.location.replace).not.toHaveBeenCalled();
        expect(t.history.push).not.toHaveBeenCalled();
        expect(t.history.replace).not.toHaveBeenCalled();
        expect(t.router.state.location.pathname).toBe("/");
        t.router.dispose();
      }
    );

    // Non-absolute locations are resolved as relative paths against the
    // redirecting route before they're processed, so an obfuscated scheme can
    // never reach window.location or history as a scheme
    it.each(getCases(OBFUSCATED_REDIRECTS))(
      "resolves %s redirects to obfuscated protocol %j as a relative path",
      async (source, url) => {
        let { t, promise } = startInvalidRedirect(source, url);
        await promise;
        let hrefs = [
          ...(t.window.location.assign as jest.Mock).mock.calls,
          ...(t.window.location.replace as jest.Mock).mock.calls,
          ...(t.history.push as jest.Mock).mock.calls,
          ...(t.history.replace as jest.Mock).mock.calls,
        ].map((args) => t.history.createHref(args[0]));
        expect(hrefs).toEqual([`/redirect/${url}`]);
        expect(new URL(hrefs[0], "http://localhost").protocol).toBe("http:");
        t.router.dispose();
      }
    );

    it("does not reject relative redirects that only contain a protocol-like string", async () => {
      let url = "/target?next=javascript:alert(1)";
      let t = setupRedirectRouter(() => redirect(url));
      await t.router.navigate("/redirect");
      expect(t.window.location.assign).not.toHaveBeenCalled();
      expect(t.window.location.replace).not.toHaveBeenCalled();
      expect(t.router.state).toMatchObject({
        historyAction: "PUSH",
        location: {
          pathname: "/target",
          search: "?next=javascript:alert(1)",
        },
        navigation: IDLE_NAVIGATION,
        errors: null,
      });
      t.router.dispose();
    });

    it("still processes external redirects to valid protocols", async () => {
      for (let url of ["https://remix.run/blog", "app://whatever"]) {
        let t = setupRedirectRouter(() => redirect(url));
        await t.router.navigate("/redirect");
        expect(t.window.location.assign).toHaveBeenCalledWith(url);
        expect(t.window.location.replace).not.toHaveBeenCalled();
        t.router.dispose();
      }
    });
  });

  describe("redirect status code handling", () => {
    it("should not treat 300 as a redirect", async () => {
      let t = setup({ routes: REDIRECT_ROUTES });

      let A = await t.navigate("/parent");
      await A.loaders.parent.redirectReturn("/idk", 300);
      expect(t.router.state).toMatchObject({
        loaderData: {},
        location: {
          pathname: "/parent",
        },
        navigation: {
          state: "idle",
        },
      });
    });

    it("should not preserve the method on 301 redirects", async () => {
      let t = setup({ routes: REDIRECT_ROUTES });

      let A = await t.navigate("/parent/child", {
        formMethod: "post",
        formData: createFormData({ key: "value" }),
      });
      // Triggers a GET redirect
      let B = await A.actions.child.redirectReturn("/parent", 301);
      await B.loaders.parent.resolve("PARENT");
      expect(t.router.state).toMatchObject({
        loaderData: {
          parent: "PARENT",
        },
        location: {
          pathname: "/parent",
        },
        navigation: {
          state: "idle",
        },
      });
    });

    it("should not preserve the method on 302 redirects", async () => {
      let t = setup({ routes: REDIRECT_ROUTES });

      let A = await t.navigate("/parent/child", {
        formMethod: "post",
        formData: createFormData({ key: "value" }),
      });
      // Triggers a GET redirect
      let B = await A.actions.child.redirectReturn("/parent", 302);
      await B.loaders.parent.resolve("PARENT");
      expect(t.router.state).toMatchObject({
        loaderData: {
          parent: "PARENT",
        },
        location: {
          pathname: "/parent",
        },
        navigation: {
          state: "idle",
        },
      });
    });

    it("should not preserve the method on 303 redirects", async () => {
      let t = setup({ routes: REDIRECT_ROUTES });

      let A = await t.navigate("/parent/child", {
        formMethod: "post",
        formData: createFormData({ key: "value" }),
      });
      // Triggers a GET redirect
      let B = await A.actions.child.redirectReturn("/parent", 303);
      await B.loaders.parent.resolve("PARENT");
      expect(t.router.state).toMatchObject({
        loaderData: {
          parent: "PARENT",
        },
        location: {
          pathname: "/parent",
        },
        navigation: {
          state: "idle",
        },
      });
    });

    it("should not treat 304 as a redirect", async () => {
      let t = setup({ routes: REDIRECT_ROUTES });

      let A = await t.navigate("/parent");
      await A.loaders.parent.resolve(new Response(null, { status: 304 }));
      expect(t.router.state).toMatchObject({
        loaderData: {},
        location: {
          pathname: "/parent",
        },
        navigation: {
          state: "idle",
        },
      });
    });

    it("should preserve the method on 307 redirects", async () => {
      let t = setup({ routes: REDIRECT_ROUTES });

      let A = await t.navigate("/parent/child", {
        formMethod: "post",
        formData: createFormData({ key: "value" }),
      });
      // Triggers a POST redirect
      let B = await A.actions.child.redirectReturn("/parent", 307);
      await B.actions.parent.resolve("PARENT ACTION");
      await B.loaders.parent.resolve("PARENT");
      expect(t.router.state).toMatchObject({
        actionData: {
          parent: "PARENT ACTION",
        },
        loaderData: {
          parent: "PARENT",
        },
        location: {
          pathname: "/parent",
        },
        navigation: {
          state: "idle",
        },
      });

      let request = B.actions.parent.stub.mock.calls[0][0].request;
      expect(request.method).toBe("POST");
      let fd = await request.formData();
      expect(Array.from(fd.entries())).toEqual([["key", "value"]]);
    });

    it("should preserve the method on 308 redirects", async () => {
      let t = setup({ routes: REDIRECT_ROUTES });

      let A = await t.navigate("/parent/child", {
        formMethod: "post",
        formData: createFormData({ key: "value" }),
      });
      // Triggers a POST redirect
      let B = await A.actions.child.redirectReturn("/parent", 308);
      await B.actions.parent.resolve("PARENT ACTION");
      await B.loaders.parent.resolve("PARENT");
      expect(t.router.state).toMatchObject({
        actionData: {
          parent: "PARENT ACTION",
        },
        loaderData: {
          parent: "PARENT",
        },
        location: {
          pathname: "/parent",
        },
        navigation: {
          state: "idle",
        },
      });

      let request = B.actions.parent.stub.mock.calls[0][0].request;
      expect(request.method).toBe("POST");
      let fd = await request.formData();
      expect(Array.from(fd.entries())).toEqual([["key", "value"]]);
    });
  });
});
