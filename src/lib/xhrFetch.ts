const extractUrl = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const extractMethod = (input: RequestInfo | URL, init?: RequestInit): string => {
  if (init?.method) return init.method;
  if (typeof input !== "string" && !(input instanceof URL)) {
    return input.method || "GET";
  }
  return "GET";
};

const applyHeaders = (xhr: XMLHttpRequest, input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers();

  if (typeof input !== "string" && !(input instanceof URL)) {
    new Headers(input.headers).forEach((value, key) => headers.set(key, value));
  }

  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }

  headers.forEach((value, key) => {
    xhr.setRequestHeader(key, value);
  });
};

const parseResponseHeaders = (rawHeaders: string): Headers => {
  const headers = new Headers();
  rawHeaders
    .trim()
    .split(/[\r\n]+/)
    .forEach((line) => {
      if (!line) return;
      const separator = line.indexOf(":");
      if (separator === -1) return;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      headers.append(key, value);
    });
  return headers;
};

export const xhrFetch: typeof fetch = async (input, init) => {
  return await new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open(extractMethod(input, init), extractUrl(input), true);
    xhr.responseType = "text";
    xhr.timeout = 12000;

    applyHeaders(xhr, input, init);

    xhr.onload = () => {
      const headers = parseResponseHeaders(xhr.getAllResponseHeaders());
      const nullBodyStatuses = [101, 204, 205, 304];
      const body = nullBodyStatuses.includes(xhr.status) ? null : xhr.responseText;
      resolve(
        new Response(body, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers,
        })
      );
    };

    xhr.onerror = () => reject(new TypeError("Failed to fetch"));
    xhr.ontimeout = () => reject(new TypeError("Request timeout"));

    if (init?.body == null) {
      xhr.send();
      return;
    }

    if (typeof init.body === "string" || init.body instanceof Blob || init.body instanceof FormData || init.body instanceof URLSearchParams) {
      xhr.send(init.body as Document | XMLHttpRequestBodyInit);
      return;
    }

    xhr.send(String(init.body));
  });
};