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
    // calendar.events grants read + write on events for the chosen calendar.
    // Required for the portal's RSVP flow (events.patch on attendee response).
    // Does NOT grant access to other Google data (Gmail, etc.).
    scope: ["https://www.googleapis.com/auth/calendar.events"],
  });

  return NextResponse.redirect(url);
}