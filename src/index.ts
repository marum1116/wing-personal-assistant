export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("wing-personal-assistant is running", {
        status: 200,
        headers: { "content-type": "text/plain; charset=UTF-8" }
      });
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      return new Response("OK", {
        status: 200,
        headers: { "content-type": "text/plain; charset=UTF-8" }
      });
    }

    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=UTF-8" }
    });
  }
};
