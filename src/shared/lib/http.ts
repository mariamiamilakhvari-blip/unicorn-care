type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestOptions = {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
};

type HttpError = {
  message: string;
  status: number;
};

type HttpClientOptions = {
  baseUrl?: string;
  onUnauthorized?: () => void;
};

class HttpClient {
  private baseUrl: string;
  private onUnauthorized?: () => void;

  constructor(options: HttpClientOptions | string = '') {
    if (typeof options === 'string') {
      this.baseUrl = options;
    } else {
      this.baseUrl = options.baseUrl ?? '';
      this.onUnauthorized = options.onUnauthorized;
    }
  }

  private serializeParams(params?: Record<string, string | number | boolean | undefined>): string {
    if (!params) return '';
    const filtered = Object.entries(params).filter(([, v]) => v !== undefined);
    if (filtered.length === 0) return '';
    const qs = new URLSearchParams(
      filtered.map(([k, v]) => [k, String(v)])
    ).toString();
    return `?${qs}`;
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const qs = this.serializeParams(options?.params);
    const url = `${this.baseUrl}${path}${qs}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    const init: RequestInit = { method, headers };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      if (response.status === 401) {
        this.onUnauthorized?.();
      }

      let message = response.statusText;
      try {
        const errorData = await response.json();
        if (errorData.error) message = errorData.error;
        else if (errorData.message) message = errorData.message;

        // A bare "VALIDATION_ERROR" tells the user nothing. When the API returns Zod's flattened
        // issues, name the offending fields so the message is actionable.
        const fieldErrors = errorData?.details?.fieldErrors;
        if (fieldErrors && typeof fieldErrors === 'object') {
          const described = Object.entries(fieldErrors as Record<string, string[]>)
            .map(([field, issues]) => `${field}: ${issues.join(', ')}`)
            .join(' · ');
          if (described) message = described;
        }
      } catch {
        // ignore parse errors
      }
      const err: HttpError = { message, status: response.status };
      throw Object.assign(new Error(message), err);
    }

    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  /**
   * `body` is optional because most deletes identify the resource by path alone. Account deletion
   * is the exception: it carries a typed confirmation, which belongs in the body rather than a
   * query string where it would end up in server logs.
   */
  delete<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, body, options);
  }
}

export const http = new HttpClient('/api');

export { HttpClient };
