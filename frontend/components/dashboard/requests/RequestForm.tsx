"use client";

import { ChevronDown, Send } from "lucide-react";
import { useState } from "react";
import { btnGhost, btnPrimary } from "@/components/dashboard/common/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEPARTMENTS } from "@/lib/departments";
import { TEAM_MEMBERS } from "./constants";
import { FileUpload } from "./FileUpload";

const departmentOptions = DEPARTMENTS;
const teamMembers = TEAM_MEMBERS;

export interface RequestFormData {
  subject: string;
  department: string;
  assignedTo: string;
  message: string;
  attachments: File[];
}

interface RequestFormProps {
  onSubmit?: (data: RequestFormData) => void | Promise<void>;
  onCancel?: () => void;
}

const labelClass =
  "text-xs uppercase tracking-[0.1em] text-sbi-muted mb-2 font-medium";

const fieldClass =
  "bg-sbi-dark border-sbi-dark-border rounded-lg px-4 py-3 h-auto text-base md:text-base text-white placeholder:text-white/30 focus-visible:border-sbi-green/50 focus-visible:ring-sbi-green/20 focus-visible:ring-[2px] shadow-none";

function RequiredAsterisk() {
  return (
    <span className="text-red-400 ml-1" aria-hidden="true">
      *
    </span>
  );
}

export function RequestForm({ onSubmit, onCancel }: RequestFormProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [department, setDepartment] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredMembers = department
    ? teamMembers.filter(
        (m) => m.department === department || m.department === null,
      )
    : teamMembers;

  const selectedMember = teamMembers.find((m) => m.value === assignedTo);
  const selectedDept = departmentOptions.find((d) => d.value === department);

  const handleDepartmentChange = (value: string) => {
    setDepartment(value);
    setAssignedTo("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSubmit?.({
      subject,
      department,
      assignedTo,
      message,
      attachments: files,
    });
    setSubject("");
    setMessage("");
    setDepartment("");
    setAssignedTo("");
    setFiles([]);
    setResetKey((k) => k + 1);
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <div>
        <Label htmlFor="request-subject" className={labelClass}>
          Subject
          <RequiredAsterisk />
        </Label>
        <Input
          id="request-subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={isSubmitting}
          className={fieldClass}
          placeholder="Brief summary of your request"
        />
      </div>

      <div>
        <Label htmlFor="request-message" className={labelClass}>
          Message
          <RequiredAsterisk />
        </Label>
        <Textarea
          id="request-message"
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isSubmitting}
          rows={5}
          className={`${fieldClass} resize-none min-h-[120px]`}
          placeholder="Describe what you need, why, and any context the team should know."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span className={`block ${labelClass}`}>Department</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-between gap-2 bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-base text-white hover:border-sbi-green/40 focus:outline-none focus:border-sbi-green/50 disabled:opacity-50"
            >
              <span className={selectedDept ? "" : "text-white/30"}>
                {selectedDept?.label ?? "Select a department"}
              </span>
              <ChevronDown className="w-4 h-4 text-sbi-muted" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={4}
              className="bg-sbi-dark border-sbi-dark-border max-h-72 custom-scrollbar w-(--radix-dropdown-menu-trigger-width)"
            >
              <DropdownMenuRadioGroup
                value={department}
                onValueChange={handleDepartmentChange}
              >
                {departmentOptions.map((o) => (
                  <DropdownMenuRadioItem
                    key={o.value}
                    value={o.value}
                    className="pl-3 [&>span:first-child]:hidden text-sm text-white focus:bg-sbi-green/10 focus:text-sbi-green data-[state=checked]:text-sbi-green data-[state=checked]:bg-sbi-green/5"
                  >
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          <span className={`block ${labelClass}`}>Assign to</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-between gap-2 bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-base text-white hover:border-sbi-green/40 focus:outline-none focus:border-sbi-green/50 disabled:opacity-50"
            >
              <span
                className={
                  selectedMember
                    ? "truncate text-left"
                    : "text-white/30 truncate text-left"
                }
              >
                {selectedMember?.label ?? "Anyone available"}
              </span>
              <ChevronDown className="w-4 h-4 text-sbi-muted shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={4}
              className="bg-sbi-dark border-sbi-dark-border max-h-72 custom-scrollbar w-(--radix-dropdown-menu-trigger-width)"
            >
              <DropdownMenuRadioGroup
                value={assignedTo}
                onValueChange={setAssignedTo}
              >
                <DropdownMenuRadioItem
                  value=""
                  className="pl-3 [&>span:first-child]:hidden text-sm text-sbi-muted italic focus:bg-sbi-green/10 focus:text-sbi-green"
                >
                  Anyone available
                </DropdownMenuRadioItem>
                {filteredMembers.map((m) => (
                  <DropdownMenuRadioItem
                    key={m.value}
                    value={m.value}
                    className="pl-3 [&>span:first-child]:hidden text-sm text-white focus:bg-sbi-green/10 focus:text-sbi-green data-[state=checked]:text-sbi-green data-[state=checked]:bg-sbi-green/5"
                  >
                    {m.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div>
        <span className={`block ${labelClass}`}>Attachments</span>
        <FileUpload key={resetKey} onFilesChange={setFiles} />
      </div>

      <div className="border-t border-sbi-dark-border pt-6 flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className={btnGhost}
          >
            Cancel
          </button>
        )}
        <button type="submit" disabled={isSubmitting} className={btnPrimary}>
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Request
            </>
          )}
        </button>
      </div>
    </form>
  );
}
