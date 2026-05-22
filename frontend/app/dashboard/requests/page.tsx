"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  btnPrimary,
  DashboardShell,
  Modal,
  PageHeader,
} from "@/components/dashboard/common/ui";
import { RequestDetailModal } from "@/components/dashboard/requests/RequestDetailModal";
import type { RequestFormData } from "@/components/dashboard/requests/RequestForm";
import { RequestForm } from "@/components/dashboard/requests/RequestForm";
import type { Request } from "@/components/dashboard/requests/RequestHistory";
import { RequestHistory } from "@/components/dashboard/requests/RequestHistory";
import { toastError, toastSuccess } from "@/lib/notifications";
import { useProject } from "@/lib/project/project-context";
import { createRequest, fetchRequests } from "@/lib/supabase/requests";

export default function RequestsPage() {
  const { activeProject, user } = useProject();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  const projectId = activeProject?.projectId;

  const loadRequests = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const data = await fetchRequests(projectId);
    setRequests(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleNewRequest = async (data: RequestFormData) => {
    if (!user) {
      toastError("You must be signed in to submit a request.");
      return;
    }
    const newRequest = await createRequest({
      projectId,
      name: user.name,
      email: user.email,
      department: data.department,
      assignTo: data.assignedTo,
      project: activeProject?.companyName,
      subject: data.subject,
      message: data.message,
      files: data.attachments,
    });
    if (!newRequest) {
      toastError("Couldn't submit your request. Please try again.", "Submission failed");
      return;
    }
    await loadRequests();
    setIsModalOpen(false);
    toastSuccess(`Request "${data.subject}" submitted.`);
  };

  const isClient = user?.role === "client";
  const subtitle = isClient
    ? "Submit a request to your team and track its progress"
    : "Incoming requests from clients";

  return (
    <DashboardShell>
      <PageHeader
        title="Requests"
        subtitle={subtitle}
        action={
          isClient ? (
            <button type="button" onClick={() => setIsModalOpen(true)} className={btnPrimary}>
              <Plus className="w-4 h-4" /> New Request
            </button>
          ) : null
        }
      />

      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Request"
        size="lg"
        padded={false}
      >
        <RequestForm onSubmit={handleNewRequest} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <main className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="space-y-3 text-center">
              <div className="w-6 h-6 border border-sbi-green/50 border-t-sbi-green rounded-full animate-spin mx-auto" />
              <p className="text-xs text-sbi-muted tracking-[0.15em] uppercase">Loading requests</p>
            </div>
          </div>
        ) : (
          <div className="h-full">
            <RequestHistory requests={requests} onRowClick={setSelectedRequest} />
          </div>
        )}
      </main>

      <RequestDetailModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />
    </DashboardShell>
  );
}
