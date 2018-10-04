import Client from "../src/client";
import fetch, { Headers } from "node-fetch";
import ResultItem from "../src/result_item";
import Replay from "replay";

const hostIdentifier = "host-2376rb";
const searchKey = "api-hean6g8dmxnm2shqqiag757a";
const engineName = "node-modules";

describe("Client", () => {
  beforeAll(() => {
    global.Headers = Headers;
    global.fetch = fetch;
  });

  const client = new Client(hostIdentifier, searchKey, engineName);

  test("can be instantiated", () => {
    expect(client).toBeInstanceOf(Client);
  });

  test("can be instantiated with options", async () => {
    const client = new Client(hostIdentifier, searchKey, engineName, {
      endpointBase: "http://localhost.swiftype.com:3002",
      cacheResponses: true
    });

    const result = await client.search("cat", {});
    expect(result).toMatchSnapshot();
  });

  describe("#search", () => {
    test("should query", async () => {
      const result = await client.search("cat", {});
      expect(result).toMatchSnapshot();
    });

    test("should should reject when given invalid options", async () => {
      try {
        await client.search();
      } catch (e) {
        expect(e).toEqual(new Error("[400] Missing required parameter: query"));
      }
    });

    test("should reject on a 404", async () => {
      const badClient = new Client("invalid", "invalid", "invalid");
      try {
        await badClient.search();
      } catch (e) {
        expect(e).toEqual(new Error("[404]"));
      }
    });

    test("should wrap grouped results in ResultItem", async () => {
      const result = await client.search("cat", {
        page: {
          size: 1
        },
        group: {
          field: "license"
        }
      });
      expect(result.results[0].data._group[0]).toBeInstanceOf(ResultItem);
    });

    describe("disjunctive facets", () => {
      const config = {
        page: {
          size: 1 //To make the response fixture manageable
        },
        filters: {
          license: ["BSD"]
        },
        facets: {
          license: [{ type: "value", size: 3 }]
        }
      };

      const licenseFacetWithFullCounts = [
        { count: 101, value: "MIT" },
        { count: 33, value: "BSD" },
        { count: 3, value: "MIT/X11" }
      ];

      const licenseFacetWithFilteredCounts = [
        {
          value: "BSD", // Only BSD values are returned, since we've filtered to BSD
          count: 33
        }
      ];

      const licenseFacetWithFilteredCountsByDependency = [
        { count: 5, value: "BSD" },
        { count: 3, value: "MIT" },
        { count: 1, value: "GPL" }
      ];

      const dependenciesFacetWithFullCounts = [
        { count: 67, value: "underscore" },
        { count: 49, value: "pkginfo" },
        { count: 48, value: "express" }
      ];

      const dependenciesFacetWithFilteredCounts = [
        { count: 5, value: "request" },
        { count: 5, value: "socket.io" },
        { count: 4, value: "express" }
      ];

      const dependenciesFacetsWithFilteredCountsByLicense = [
        { count: 5, value: "request" },
        { count: 5, value: "socket.io" },
        { count: 4, value: "express" }
      ];

      it("returns filtered facet values when facet is not disjunctive", async () => {
        const result = await client.search("cat", config);
        expect(result.info.facets.license[0].data).toEqual(
          licenseFacetWithFilteredCounts
        );
      });

      it("returns facet counts as if filter is not applied and facet is disjunctive", async () => {
        const result = await client.search("cat", {
          ...config,
          disjunctiveFacets: ["license"]
        });

        expect(result.info.facets.license[0].data).toEqual(
          licenseFacetWithFullCounts
        );
      });

      it("returns filtered facet values if facet is disjunctive, but no corresponding filter is applied", async () => {
        const result = await client.search("cat", {
          ...config,
          filters: {},
          disjunctiveFacets: ["license"]
        });

        expect(result.info.facets.license[0].data).toEqual(
          licenseFacetWithFullCounts
        );
      });

      it("will return full results when multiple disjunctive facets, but no filters", async () => {
        const result = await client.search("cat", {
          page: { size: 1 },
          facets: {
            license: [{ type: "value", size: 3 }],
            dependencies: [{ type: "value", size: 3 }]
          },
          disjunctiveFacets: ["license", "dependencies"]
        });

        expect(result.info.facets.license[0].data).toEqual(
          licenseFacetWithFullCounts
        );
        expect(result.info.facets.dependencies[0].data).toEqual(
          dependenciesFacetWithFullCounts
        );
      });

      it("will return only one set of filtered facet counts when  multiple disjunctive facets, with only one filter", async () => {
        const result = await client.search("cat", {
          ...config,
          filters: {
            license: "BSD"
          },
          facets: {
            license: [{ type: "value", size: 3 }],
            dependencies: [{ type: "value", size: 3 }]
          },
          disjunctiveFacets: ["license", "dependencies"]
        });

        expect(result.info.facets.license[0].data).toEqual(
          licenseFacetWithFullCounts
        );
        expect(result.info.facets.dependencies[0].data).toEqual(
          dependenciesFacetWithFilteredCounts
        );
      });

      it("will return both sets of filtered facet counts when multiple disjunctive facets and both are filtered", async () => {
        const result = await client.search("cat", {
          ...config,
          filters: {
            all: [{ license: "BSD" }, { dependencies: "socket.io" }]
          },
          facets: {
            license: [{ type: "value", size: 3 }],
            dependencies: [{ type: "value", size: 3 }]
          },
          disjunctiveFacets: ["license", "dependencies"]
        });

        expect(result.info.facets.license[0].data).toEqual(
          licenseFacetWithFilteredCountsByDependency
        );
        expect(result.info.facets.dependencies[0].data).toEqual(
          dependenciesFacetsWithFilteredCountsByLicense
        );
      });

      it("works when facets don't use array syntax", async () => {
        const result = await client.search("cat", {
          ...config,
          filters: {
            all: [{ license: "BSD" }, { dependencies: "socket.io" }]
          },
          facets: {
            license: { type: "value", size: 3 },
            dependencies: [{ type: "value", size: 3 }]
          },
          disjunctiveFacets: ["license", "dependencies"]
        });

        expect(result.info.facets.license[0].data).toEqual(
          licenseFacetWithFilteredCountsByDependency
        );
        expect(result.info.facets.dependencies[0].data).toEqual(
          dependenciesFacetsWithFilteredCountsByLicense
        );
      });
    });
  });

  describe("#click", () => {
    test("should resolve", async () => {
      const result = await client.click({
        query: "Cat",
        documentId: "rex-cli",
        requestId: "8b55561954484f13d872728f849ffd22",
        tags: ["Cat"]
      });
      expect(result).toMatchSnapshot();
    });

    test("should resolve if no tags are provided", async () => {
      const result = await client.click({
        query: "Cat",
        documentId: "rex-cli",
        requestId: "8b55561954484f13d872728f849ffd22"
      });
      expect(result).toMatchSnapshot();
    });

    test("should should reject when given invalid options", async () => {
      try {
        await client.click({});
      } catch (e) {
        expect(e).toEqual(new Error("[400] Missing required parameter: query"));
      }
    });

    test("should reject on a 404", async () => {
      const badClient = new Client("invalid", "invalid", "invalid");
      try {
        await badClient.click({});
      } catch (e) {
        expect(e).toEqual(new Error("[404]"));
      }
    });
  });
});
