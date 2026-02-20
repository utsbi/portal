'use client';

import { useState } from 'react';
import { fakeConvo } from './messages_dataplacholder';

export function CreateNew() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const handleNext = () => {
    setOpen(false);
    setSelected("");
  }

  // modal that simulates creating a new conversation (for now it has now functionality just for aesthetic purposes)
  // clients are only showed contacting a director
  // directors are able to search up any users to contact
  return(
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-gray-600 text-white text-2xl flex items-center justify-center shadow-lg"
      >
        +
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-gray-800 rounded-lg p-6 w-96 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-white text-lg font-medium mb-4">
              Send a Message
            </h2>

            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-700 text-white text-sm px-3 py-2 focus:outline-none"
            >
              <option value="" disabled>
                Select a director
              </option>
              {fakeConvo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 text-sm font-medium bg-gray-600 text-white rounded disabled:opacity-50 "
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}