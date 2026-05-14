drop policy if exists "View accessible leads" on public.leads;

create policy "View accessible leads"
  on public.leads for select
  using (
    deleted_at is null
    and organization_id = get_user_org_id(auth.uid())
    and (
      has_role(auth.uid(), 'owner'::app_role, organization_id)
      or has_role(auth.uid(), 'manager'::app_role, organization_id)
      or created_by = auth.uid()
      or assigned_to = auth.uid()
      or exists (
        select 1
        from public.lead_assignees la
        where la.lead_id = leads.id
          and la.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.lead_shares ls
        where ls.lead_id = leads.id
          and ls.shared_with_user_id = auth.uid()
      )
    )
  );

drop policy if exists "Update accessible leads" on public.leads;

create policy "Update accessible leads"
  on public.leads for update
  using (
    organization_id = get_user_org_id(auth.uid())
    and (
      has_role(auth.uid(), 'owner'::app_role, organization_id)
      or has_role(auth.uid(), 'manager'::app_role, organization_id)
      or created_by = auth.uid()
      or assigned_to = auth.uid()
      or exists (
        select 1
        from public.lead_assignees la
        where la.lead_id = leads.id
          and la.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.lead_shares ls
        where ls.lead_id = leads.id
          and ls.shared_with_user_id = auth.uid()
      )
    )
  )
  with check (
    organization_id = get_user_org_id(auth.uid())
  );