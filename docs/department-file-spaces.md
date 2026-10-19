# Department file spaces

Department-owned files have a persistent home separate from project files.

```text
Files
├── Project space: one project, one project membership boundary
└── Department space: Business, Legal, etc.; persistent across projects
```

Every file belongs to exactly one space. A department file can optionally link
to multiple projects through `department_file_project_links`. The link is
context only: it never grants the linked project's members access to the file.

## Access

- Project spaces keep the existing project-membership rules.
- Department spaces use `file_space_members` as an access list, not a second
  role system.
- Directors and presidents are global staff and can manage every space.
- Members can access the spaces they belong to and upload files there.
- Existing member `profiles.department` values are backfilled as memberships;
  explicit cross-department memberships survive department changes.

## Storage

- Project files remain under `{project_id}/...`.
- Department files use `department/{department_id}/...`.
- Storage RLS resolves the path to a `file_spaces` row before allowing reads or
  writes; frontend path selection is not the security boundary.
