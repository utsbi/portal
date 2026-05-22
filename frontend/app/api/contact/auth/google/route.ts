import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    // calendar.events: read + write on events (RSVP via events.patch).
    // calendar.calendarlist.readonly: list the director's calendars so they
    // can pick which one the portal reads from — events scope alone doesn't
    // include calendar list access. Both together give us exactly what the
    // portal needs and nothing more (no Gmail, no full Calendar admin).
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    ],
  });

  return NextResponse.redirect(url);
}