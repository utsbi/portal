"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Modal, Button } from "@mantine/core";
import { Plus } from "lucide-react";
import { RequestForm } from "@/components/dashboard/requests/RequestForm";
import { RequestHistory } from "@/components/dashboard/requests/RequestHistory";
import { fetchRequests, createRequest } from "@/lib/supabase/requests";
import type { Request } from "@/components/dashboard/requests/RequestHistory";
import { useProject } from "@/lib/project/project-context";

export default function RequestsPage() {
  const { activeProject } = useProject();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const handleNewRequest = async (data: any) => {
    const newRequest = await createRequest({
      projectId: projectId,
      name: data.name,
      email: data.email,
      department: data.department,
      assignTo: data.assignedTo,
      project: data.project,
      subject: data.subject,
      message: data.message,
      files: data.attachments as File[] | undefined,
    });

    if (!newRequest) return;
    await loadRequests();
    setIsModalOpen(false);
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-sbi-dark flex flex-col p-6 md:p-8 overflow-hidden">
      <div className="max-w-[1800px] w-full mx-auto flex flex-col h-full">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-8 shrink-0"
        >
          <h1 className="text-2xl md:text-3xl font-light tracking-tight text-white">
            Requests
          </h1>
          <Button
            onClick={() => setIsModalOpen(true)}
            leftSection={<Plus size={16} />}
            className="bg-sbi-green text-sbi-dark hover:bg-sbi-green/90 transition-colors uppercase tracking-wider text-xs font-semibold px-6 h-10"
            radius="md"
          >
            New Request
          </Button>
        </motion.div>

        {/* Modal for New Request */}
        <Modal
          opened={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create New Request"
          size="xl"
          classNames={{
            inner: "custom-scrollbar",
            content: "!bg-sbi-dark !text-white !border !border-sbi-dark-border/50",
            header: "!bg-sbi-dark-card !border-b !border-sbi-dark-border/50",
            body: "!bg-sbi-dark custom-scrollbar",
            title: "text-lg font-light tracking-wider uppercase text-sbi-muted",
            close: "text-sbi-muted hover:text-white hover:bg-white/10 transition-colors",
          }}
        >
          <div className="p-4">
            <RequestForm onSubmit={handleNewRequest} />
          </div>
        </Modal>

        {/* Request History */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-1 overflow-hidden"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="space-y-3 text-center">
                <div className="w-6 h-6 border border-sbi-green/50 border-t-sbi-green rounded-full animate-spin mx-auto" />
                <p className="text-xs text-sbi-muted tracking-[0.15em] uppercase">Loading requests</p>
              </div>
            </div>
          ) : (
            <div className="h-full">
              <RequestHistory requests={requests} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
