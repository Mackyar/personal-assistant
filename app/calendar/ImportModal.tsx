import { useState, useRef, useEffect } from 'react';
import { X, Upload, Check, AlertCircle, Bot, Loader2 } from 'lucide-react';
import { extractSections, parseTimetable, ParsedClass } from '@/lib/utils/csvParser';
import { createEvent } from '@/lib/db/events';
import { getSettings } from '@/lib/db/settings';
import { getAIProvider, hasRequiredKey } from '@/lib/ai/client';
import toast from 'react-hot-toast';

interface ImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

export function ImportModal({ onClose, onImported }: ImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [csvData, setCsvData] = useState<string>('');
  const [sections, setSections] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [parsedEvents, setParsedEvents] = useState<ParsedClass[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [hasAi, setHasAi] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then(s => {
      setHasAi(hasRequiredKey(s));
    });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvData(text);
      const foundSections = extractSections(text);
      if (foundSections.length === 0) {
        // Not a standard university timetable. Offer AI import automatically if AI keys are configured
        setSections([]);
        setSelectedSection('');
      } else {
        setSections(foundSections);
        if (foundSections.length === 1) setSelectedSection(foundSections[0]);
      }
      setStep(2);
    };
    reader.readAsText(file);
  };

  const handleAiParse = async () => {
    setAiLoading(true);
    try {
      const settings = await getSettings();
      if (!hasRequiredKey(settings)) {
        toast.error('Please configure an AI provider key in Settings first!');
        setAiLoading(false);
        return;
      }
      const provider = await getAIProvider(settings);
      const response = await provider.chat([
        {
          role: 'system',
          content: `You are an expert scheduler. Analyze the provided raw CSV text and extract all calendar events. 
Return ONLY a valid JSON array of objects representing the events. Do not include markdown blocks like \`\`\`json. 
Each event object MUST have:
- title (string, name of event or class)
- date (string, in YYYY-MM-DD format. If date is not specified, assume current year 2026)
- startTime (string, 24h format HH:mm)
- endTime (string, 24h format HH:mm)
- location (string, room, building or online)

Example output:
[{"title":"Math Class","date":"2026-07-15","startTime":"09:00","endTime":"10:30","location":"Room 101"}]`
        },
        { role: 'user', content: csvData }
      ]);

      // Clean response text in case model included markdown codeblocks
      const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const events = JSON.parse(cleanJson);
      if (Array.isArray(events)) {
        const parsed = events.map((ev: any) => ({
          id: crypto.randomUUID(),
          title: ev.title || 'Event',
          date: ev.date || new Date().toISOString().split('T')[0],
          startTime: ev.startTime || '09:00',
          endTime: ev.endTime || '10:00',
          location: ev.location || '',
          color: '#3b82f6',
        }));
        setParsedEvents(parsed);
        setStep(3);
      } else {
        toast.error('AI response was not a valid list of events.');
      }
    } catch (err) {
      console.error(err);
      toast.error('AI parsing failed. Check your API key or CSV file size.');
    }
    setAiLoading(false);
  };

  const handleSectionSelect = () => {
    if (!selectedSection) return;
    const events = parseTimetable(csvData, selectedSection);
    setParsedEvents(events);
    setStep(3);
  };

  const handleImport = async () => {
    setIsImporting(true);
    let count = 0;
    try {
      for (const ev of parsedEvents) {
        await createEvent({
          title: ev.title,
          date: ev.date,
          startTime: ev.startTime,
          endTime: ev.endTime,
          location: ev.location,
          color: ev.color,
        });
        count++;
      }
      toast.success(`Successfully imported ${count} classes!`);
      onImported();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Import failed');
    }
    setIsImporting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm fade-in">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload size={18} className="text-primary" /> Import Timetable
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {step === 1 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
                <Upload size={24} />
              </div>
              <h3 className="font-medium text-foreground">Upload CSV File</h3>
              <p className="text-sm text-muted-foreground">
                Export your timetable Excel sheet as a <strong>.csv (Comma delimited)</strong> file and upload it here.
              </p>
              
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary w-full justify-center mt-4"
              >
                Select CSV File
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 fade-in">
              {sections.length > 0 ? (
                <>
                  <h3 className="font-medium text-foreground">Select Your Section</h3>
                  <p className="text-sm text-muted-foreground">
                    We found multiple sections in this timetable. Which one are you in?
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {sections.map(s => (
                      <button
                        key={s}
                        onClick={() => setSelectedSection(s)}
                        className={`p-3 rounded-xl border text-center transition-all ${selectedSection === s ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:bg-secondary text-foreground'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={handleSectionSelect}
                    disabled={!selectedSection}
                    className="btn-primary w-full justify-center mt-4 disabled:opacity-50"
                  >
                    Continue
                  </button>

                  {hasAi && (
                    <div className="text-center pt-2">
                      <button
                        onClick={handleAiParse}
                        disabled={aiLoading}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1.5"
                      >
                        {aiLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Analyzing with AI...
                          </>
                        ) : (
                          <>
                            <Bot size={13} />
                            Or parse with AI (any custom schedule)
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center space-y-4 py-2">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                    <Bot size={20} />
                  </div>
                  <h3 className="font-medium text-foreground">AI Import Assistant</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This file doesn't match the standard university timetable grid. We can use your active AI provider to read this schedule and extract the events automatically!
                  </p>

                  {hasAi ? (
                    <button
                      onClick={handleAiParse}
                      disabled={aiLoading}
                      className="btn-primary w-full justify-center mt-4 flex items-center gap-2"
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analyzing schedule...
                        </>
                      ) : (
                        <>
                          <Bot size={14} />
                          Parse with AI
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-xs text-destructive flex items-start gap-2 text-left mt-4 animate-pulse">
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>AI Key Required:</strong> To parse custom CSV formats, please configure an AI provider API key (like OpenAI, Gemini, Anthropic, or LLM7) in settings first.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 fade-in">
              <div className="flex items-center gap-2 text-green-400 bg-green-400/10 p-3 rounded-xl mb-4">
                <Check size={18} />
                <span className="text-sm font-medium">Found {parsedEvents.length} events {selectedSection ? `for ${selectedSection}` : ''}</span>
              </div>
              
              <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {parsedEvents.map((ev, i) => (
                  <div key={i} className="p-3 bg-secondary rounded-lg border border-border">
                    <p className="text-sm font-medium truncate">{ev.title}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{ev.date}</span>
                      <span>{ev.startTime} - {ev.endTime}</span>
                      {ev.location && <span className="truncate max-w-[100px]">📍 {ev.location}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={handleImport}
                disabled={isImporting || parsedEvents.length === 0}
                className="btn-primary w-full justify-center mt-4"
              >
                {isImporting ? 'Importing...' : 'Save to Calendar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
