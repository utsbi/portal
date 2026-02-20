"use client"
import { notFound } from "next/navigation";
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function CalendarPage() {
  //notFound();

  const supabase = createClient()
  const [calendarId, setCalendarId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) return setError(authErr.message)
      if (!authData.user) return setError("Not logged in.")

      const { data, error } = await supabase
        .from("clients")
        .select("calendar_id")
        .eq("uid", authData.user.id)
        .single()
      
      if (error) return setError(error.message)
      if (!data?.calendar_id) return setError("No calendar_id on this client.")

      setCalendarId(data.calendar_id)
    }

    run()
  }, [supabase])

  if (error) return <div className="p-4">Calendar error: {error}</div>
  if (!calendarId) return <div className="p-4">Loading calendar...</div>

  const embedSrc = `https://calendar.google.com/calendar/embed?height=600&wkst=1&ctz=America%2FChicago&showPrint=0&showTitle=0&showTabs=0&src=${encodeURIComponent(
    calendarId
  )}`

  return (
    <div className="w-full flex justify-center">
      <div className="relative h-[70vh] w-full max-w-5xl overflow-hidden rounded-xl border bg-white shadow-sm">
        <iframe
          title="Client Calendar"
          src={embedSrc}
          className="h-full w-full"
          //frameBorder="0"
          //scrolling="no"
        />
      </div>
    </div>
  )
}
