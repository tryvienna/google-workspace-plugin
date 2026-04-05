export const GMAIL_THREAD_URI_SEGMENTS = ['threadId'] as const;
export const GMAIL_THREAD_URI_PATH = { segments: GMAIL_THREAD_URI_SEGMENTS as readonly string[] };

export const CALENDAR_EVENT_URI_SEGMENTS = ['eventId'] as const;
export const CALENDAR_EVENT_URI_PATH = { segments: CALENDAR_EVENT_URI_SEGMENTS as readonly string[] };

export const DRIVE_FILE_URI_SEGMENTS = ['fileId'] as const;
export const DRIVE_FILE_URI_PATH = { segments: DRIVE_FILE_URI_SEGMENTS as readonly string[] };

export const DOCS_DOCUMENT_URI_SEGMENTS = ['documentId'] as const;
export const DOCS_DOCUMENT_URI_PATH = { segments: DOCS_DOCUMENT_URI_SEGMENTS as readonly string[] };
