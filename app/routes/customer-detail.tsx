import { Link, isRouteErrorResponse, useRouteError } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ApiError, apiFetch } from "~/lib/api";
import { agentsById } from "~/lib/entities";
import { fmtDate, fmtKwh, fmtMoney, fmtText, oneLineAddress } from "~/lib/format";
import { DomainTerm } from "~/components/domain-term";
import { Field, FieldList } from "~/components/field";
import type {
  ContractRow,
  CustomerListItem,
  DealListItem,
  EsiListItem,
  ListPage,
  LoaListItem,
  ServiceAddressListItem,
} from "~/lib/types";
import type { Route } from "./+types/customer-detail";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `${data?.customer.name ?? "Customer"} · VireCRM` }];
}

function listAll<T>(path: string, customerId: string): Promise<ListPage<T>> {
  const qs = new URLSearchParams({ customerId, limit: "100" });
  return apiFetch(`/api/${path}?${qs}`);
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const [customer, addresses, esis, contracts, deals, loas, agents] = await Promise.all([
    // 404 from the API → route-level 404 so the ErrorBoundary can name it.
    apiFetch<CustomerListItem>(`/api/customers/${params.id}`).catch((e) => {
      if (e instanceof ApiError && e.status === 404) {
        throw new Response("Not Found", { status: 404 });
      }
      throw e;
    }),
    listAll<ServiceAddressListItem>("service-addresses", params.id),
    listAll<EsiListItem>("esis", params.id),
    listAll<ContractRow>("contracts", params.id),
    listAll<DealListItem>("deals", params.id),
    listAll<LoaListItem>("loas", params.id),
    agentsById(),
  ]);
  return {
    customer,
    addresses: addresses.items,
    esis: esis.items,
    contracts: contracts.items,
    deals: deals.items,
    loas: loas.items,
    agents,
  };
}

export function HydrateFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {notFound ? "Customer not found." : "Something went wrong loading this customer."}
    </p>
  );
}

export default function CustomerDetail({ loaderData }: Route.ComponentProps) {
  const { customer, addresses, esis, contracts, deals, loas, agents } = loaderData;
  const esisByAddress = new Map<string, EsiListItem[]>();
  for (const esi of esis) {
    const list = esisByAddress.get(esi.serviceAddressId) ?? [];
    list.push(esi);
    esisByAddress.set(esi.serviceAddressId, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
        <p className="text-sm text-muted-foreground">Customer record</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldList>
            <Field label="Primary contact">{fmtText(customer.primaryContactName)}</Field>
            <Field label="Email">{fmtText(customer.primaryEmail)}</Field>
            <Field label="Phone">{fmtText(customer.primaryPhone)}</Field>
            <Field label="External customer ID">
              <span className="font-mono text-xs">{fmtText(customer.externalCustomerId)}</span>
            </Field>
          </FieldList>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Service addresses & <DomainTerm term="ESI ID">ESIs</DomainTerm>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No service addresses on file.</p>
          ) : (
            addresses.map((addr) => {
              const addrEsis = esisByAddress.get(addr.id) ?? [];
              return (
                <div key={addr.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{oneLineAddress(addr)}</p>
                  {addr.county || addr.govtArea ? (
                    <p className="text-xs text-muted-foreground">
                      {[addr.county, addr.govtArea].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  {addrEsis.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">No ESIs at this address.</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              <DomainTerm term="ESI ID" />
                            </TableHead>
                            <TableHead>
                              <DomainTerm term="Physical Meter Serial">Meter serial</DomainTerm>
                            </TableHead>
                            <TableHead>
                              <DomainTerm term="EAC" />
                            </TableHead>
                            <TableHead>
                              <DomainTerm term="Billing AQ" />
                            </TableHead>
                            <TableHead>Annual usage</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {addrEsis.map((esi) => (
                            <TableRow key={esi.id}>
                              <TableCell className="font-mono text-xs">{esi.esiId}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {fmtText(esi.physicalMeterSerial)}
                              </TableCell>
                              <TableCell>{fmtKwh(esi.eacKwh)}</TableCell>
                              <TableCell>{fmtKwh(esi.billingAqKwh)}</TableCell>
                              <TableCell>{fmtKwh(esi.annualUsageKwh)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contracts on file.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <DomainTerm term="REP">Supplier</DomainTerm>
                    </TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <DomainTerm term="Is Live">Live</DomainTerm>
                    </TableHead>
                    <TableHead>
                      <DomainTerm term="Net TCV" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link to={`/contracts/${c.id}`} className="font-medium hover:underline">
                          {c.supplier || "(no supplier)"}
                        </Link>
                      </TableCell>
                      <TableCell>{fmtDate(c.startDate)}</TableCell>
                      <TableCell>{fmtDate(c.endDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.pipelineStatus}</Badge>
                      </TableCell>
                      <TableCell>{c.isLive ? <Badge>Live</Badge> : "—"}</TableCell>
                      <TableCell>{fmtMoney(c.netTcv, c.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Deals</CardTitle>
        </CardHeader>
        <CardContent>
          {deals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deals on file.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal</TableHead>
                    <TableHead>
                      <DomainTerm term="Pipeline Stage">Stage</DomainTerm>
                    </TableHead>
                    <TableHead>
                      <DomainTerm term="Sale Status" />
                    </TableHead>
                    <TableHead>
                      <DomainTerm term="Pri/Sec Agent">Agents</DomainTerm>
                    </TableHead>
                    <TableHead>Sale date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((d) => {
                    const agentNames = [d.primaryAgentId, d.secondaryAgentId]
                      .map((id) => (id ? agents.get(id)?.name : null))
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Link to={`/deals/${d.id}`} className="font-medium hover:underline">
                            {d.name || customer.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{d.stage}</Badge>
                        </TableCell>
                        <TableCell>{fmtText(d.saleStatus)}</TableCell>
                        <TableCell>{agentNames || "—"}</TableCell>
                        <TableCell>{fmtDate(d.saleDate)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <DomainTerm term="LOA">LOAs</DomainTerm>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No LOAs on file.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Signed</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loas.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{fmtDate(l.signedDate)}</TableCell>
                      <TableCell>{fmtDate(l.expirationDate)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {fmtText(l.pdfStoragePath)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
