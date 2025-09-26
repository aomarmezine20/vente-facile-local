import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDocuments, getClients, getDepots } from "@/store/localdb";
import { fmtMAD } from "@/utils/format";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";

interface SearchResult {
  id: string;
  code: string;
  type: string;
  mode: string;
  date: string;
  client: string;
  total: number;
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    const documents = getDocuments();
    const clients = getClients();
    const depots = getDepots();
    
    const filteredDocs = documents.filter(doc => 
      doc.code.toLowerCase().includes(query.toLowerCase()) ||
      doc.id.toLowerCase().includes(query.toLowerCase())
    );
    
    const searchResults: SearchResult[] = filteredDocs.map(doc => {
      const client = doc.clientId 
        ? clients.find(c => c.id === doc.clientId)?.name 
        : doc.vendorName || "-";
      
      const total = doc.lines.reduce((s, l) => s + (l.unitPrice - l.remiseAmount) * l.qty, 0);
      
      return {
        id: doc.id,
        code: doc.code,
        type: doc.type,
        mode: doc.mode,
        date: doc.date,
        client,
        total
      };
    });
    
    setResults(searchResults);
    setIsSearching(false);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par code document (ex: V-DV-000001)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching}>
          Rechercher
        </Button>
        {results.length > 0 && (
          <Button variant="outline" onClick={clearSearch}>
            Effacer
          </Button>
        )}
      </div>

      {results.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Résultats de recherche ({results.length})</h3>
            <div className="space-y-2">
              {results.map((result) => (
                <div key={result.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{result.type}</Badge>
                    <div>
                      <div className="font-medium">{result.code}</div>
                      <div className="text-sm text-muted-foreground">
                        {result.mode === "vente" ? "Vente" : "Achat"} • {result.client} • {new Date(result.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{fmtMAD(result.total)}</span>
                    <Button asChild size="sm" variant="secondary">
                      <Link to={`/document/${result.id}`}>Voir</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}