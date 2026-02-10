import { notFound } from "next/navigation";

export default function CalendarPage() {
  //notFound();

  /* Notes from Tech Meeting:
   * 1) Move to middle?
   * 2) Show week view too.
   * 3) Connect to Apple Calender (my apple device), using the same .ics file, it will just make a copy
   * 4) Darkmode, just one parameter to change
  */

  const embedMonthSrc = "https://calendar.google.com/calendar/embed?height=500&wkst=1&ctz=America%2FChicago&showPrint=0&src=ODEzZWRkODNmYzViMzUwZDAxMDViMjc3ZmIwMjlkOGM2YTczMmRiOTFiYTU3NThlYjExNjI3YTdmODExOGM0YkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&color=%237986cb"
  const embedWeekSrc =  "https://calendar.google.com/calendar/embed?height=500&wkst=1&ctz=America%2FChicago&showPrint=0&mode=WEEK&src=ODEzZWRkODNmYzViMzUwZDAxMDViMjc3ZmIwMjlkOGM2YTczMmRiOTFiYTU3NThlYjExNjI3YTdmODExOGM0YkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&color=%237986cb" 


  return (
    //<div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex w-full justify center">
        <iframe
            src={embedMonthSrc}
            title="Calendar"
            className="h-[500px] w-[500px] rounded-lg border border-black-400"
            frameBorder={0}
            scrolling="no"
          />
        <div className="flex w-full justify center">
          <iframe 
          src={embedWeekSrc}
          title="Calendar"
          className="h-[500px] w-[800px] rounded-lg border border-black-400"
          />
        </div>
      </div>
    //</div>
  );
}
