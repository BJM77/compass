
"use client";

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { Trash2, Calendar, Frown, Loader2 } from 'lucide-react';

export function LostCustomersView() {
  const db = useFirestore();

  const lostQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'lostCustomers'), orderBy('lostAt', 'desc'));
  }, [db]);

  const { data: lostDeals, isLoading } = useCollection(lostQuery);

  return (
    <Card className="border-none shadow-xl bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Weekly Lost Customers Archive
            </CardTitle>
            <CardDescription>
              Opportunities marked as lost for analysis and future win-back strategy.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : lostDeals?.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
            <Frown className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-sm font-medium text-muted-foreground">No lost opportunities recorded.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">
                <TableHead>Opportunity / Business</TableHead>
                <TableHead>Archive Week</TableHead>
                <TableHead>Reason / Barrier</TableHead>
                <TableHead className="text-right">Lost Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lostDeals?.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell className="font-bold">{deal.pipeline}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      Week {deal.week.split('-')[1]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground italic">
                    {deal.reason}
                  </TableCell>
                  <TableCell className="text-right text-[10px] font-mono opacity-60">
                    {deal.lostAt?.toDate ? format(deal.lostAt.toDate(), 'PPP') : 'N/A'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
