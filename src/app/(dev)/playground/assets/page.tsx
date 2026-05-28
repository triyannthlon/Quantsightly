import { UniversalSearchBar } from "@/components/custom/assets/universal-search-bar";

export default function AssetsSearchPage() {
    const examples = [
        { label: "Apple", hint: "Nom" },
        { label: "AAPL", hint: "Symbol" },
        { label: "SPY.US", hint: "Symbol complet" },
        { label: "US0378331005", hint: "ISIN Apple" },
        { label: "IE00B4L5Y983", hint: "ISIN ETF World" },
    ];

    return (
        <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12">
            <div className="w-full max-w-3xl">
                <header className="text-center mb-10">
                    <h1 className="text-title-md font-bold text-foreground mb-3">
                        Explorer un actif financier
                    </h1>
                    <p className="text-muted-foreground text-base">
                        Recherchez une action ou un ETF par nom, symbole ou code ISIN.
                    </p>
                </header>

                <UniversalSearchBar />

                <div className="mt-12 text-center">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                        Essayez par exemple
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {examples.map((ex) => (
                            <span
                                key={ex.label}
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-full bg-muted text-muted-foreground border border-border"
                                title={ex.hint}
                            >
                <span className="font-mono">{ex.label}</span>
                <span className="text-[10px] opacity-70">· {ex.hint}</span>
              </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}