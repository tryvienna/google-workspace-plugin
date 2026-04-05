# Google Workspace

Gmail, Calendar, Docs, and Drive — powered by the `gws` CLI.

## Features

- **Inbox** — Browse Gmail threads, read full message bodies, send emails
- **Calendar** — View your agenda, browse events with attendee RSVP status, create new events
- **Docs** — Read Google Docs with full formatting, review and accept or reject inline suggestions
- **Drive** — Search and browse recent files across Docs, Sheets, Slides, PDFs, and more
- **Search** — All four services are searchable as entities across Vienna

## Setup

Install the [gws CLI](https://www.npmjs.com/package/@googleworkspace/cli) and authenticate:

```
npm i -g @googleworkspace/cli
gws auth login
```

Follow the browser prompts to sign in with your Google account. No additional credentials or OAuth configuration is needed in Vienna — authentication is handled entirely by the `gws` CLI.

## Configuration

Open the plugin settings to customize:

- **Inbox query** — Filter threads with Gmail search syntax (e.g. `is:unread`, `from:alice@`, `label:important`)
- **Agenda range** — Show events for today, this week, or the next 7 days
- **Drive file type** — Filter by Google Docs, Sheets, Slides, Folders, PDFs, or all files
- **Result limits** — Control how many threads, events, and files appear in the sidebar
