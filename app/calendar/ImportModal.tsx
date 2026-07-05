'use client';

import { useState, useRef } from 'react';
import { X, Upload, Check, AlertCircle } from 'lucide-react';
import { extractSections, parseTimetable, ParsedClass } from '@/lib/utils/csvParser';
import { createEvent } from '@/lib/db/events';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvData(text);
      const foundSections = extractSections(text);
      if (foundSections.length === 0) {
        toast.error('Could not find any sections in this CSV format.');
        return;
      }
      setSections(foundSections);
      if (foundSections.length === 1) setSelectedSection(foundSections[0]);
      setStep(2);
    };
    reader.readAsText(file);
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
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 fade-in">
              <div className="flex items-center gap-2 text-green-400 bg-green-400/10 p-3 rounded-xl mb-4">
                <Check size={18} />
                <span className="text-sm font-medium">Found {parsedEvents.length} classes for {selectedSection}</span>
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
