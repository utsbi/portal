-- Let a project's directors remove that project's RAG documents (the Explore
-- Sources panel "remove" action). The pre-existing delete policies only let the
-- original uploader delete their own rows; this lets any director on the project
-- manage the corpus, matching the Files-bucket write model.
DROP POLICY IF EXISTS "Project directors can delete client knowledge" ON public.client_knowledge;
CREATE POLICY "Project directors can delete client knowledge" ON public.client_knowledge
  FOR DELETE TO authenticated
  USING (
    project_id IS NOT NULL
    AND public.is_director(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.project_members pm
      JOIN public.profiles pr ON pr.id = pm.profile_id
      WHERE pr.uid = auth.uid()
        AND pm.project_id = client_knowledge.project_id
    )
  );
