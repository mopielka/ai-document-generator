import React, { useState, useEffect } from 'react';
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  Grid,
  Alert,
  CircularProgress
} from '@mui/material';
import { UploadFile } from '@mui/icons-material';

const App: React.FC = () => {
  // Stany aplikacji
  const [apiKey, setApiKey] = useState<string>('');
  const [storedApiKey, setStoredApiKey] = useState<string>('');
  const [documentPrompt, setDocumentPrompt] = useState<string>(''); // opis dokumentu formalnego
  const [fieldsDefinition, setFieldsDefinition] = useState<Array<{ name: string; type: string }> | null>(null);
  const [formData, setFormData] = useState<{ [key: string]: any }>({});
  const [documentHtml, setDocumentHtml] = useState<string>(''); // wygenerowany dokument HTML
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [step, setStep] = useState<number>(1); // 1: opis, 2: formularz, 3: dokument

  // Ładowanie klucza API przy starcie
  useEffect(() => {
    const savedKey = localStorage.getItem('openaiApiKey');
    if (savedKey) {
      setApiKey(savedKey);
      setStoredApiKey(savedKey);
    }
  }, []);

  const handleApiKeySave = () => {
    localStorage.setItem('openaiApiKey', apiKey);
    setStoredApiKey(apiKey);
  };

  const handleApiKeyClear = () => {
    localStorage.removeItem('openaiApiKey');
    setApiKey('');
    setStoredApiKey('');
  };

  const handleDocumentPromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocumentPrompt(e.target.value);
  };

  // Funkcja pomocnicza – generowanie nazwy pliku na podstawie HTML
  const generateFilename = (htmlContent: string): string => {
    let match = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/i) || htmlContent.match(/<h2[^>]*>(.*?)<\/h2>/i);
    let name = match ? match[1].trim() : 'dokument';
    name = name.replace(/[\\\/:*?"<>|]/g, '');
    return name || 'dokument';
  };

  // Funkcja do wysłania zapytania o definicję pól
  const generateFields = async () => {
    setError('');
    if (!storedApiKey) {
      setError('Brak klucza API OpenAI. Proszę go wpisać.');
      return;
    }
    if (!documentPrompt.trim()) {
      setError('Proszę wpisać opis dokumentu.');
      return;
    }
    setLoading(true);

    // Instrukcja dla GPT – wszystko przekazane w jednej wiadomości:
    const instruction = `
Na podstawie poniższego opisu dokumentu formalnego, podaj wyłącznie poprawny JSON w formie tablicy obiektów. Każdy obiekt powinien mieć właściwości "name" oraz "type" (np. "text", "number", "date", "email"), które określają dane potrzebne do wygenerowania dokumentu.
Opis dokumentu:
${documentPrompt}
    `;

    const messages = [
      {
        role: 'user',
        content: instruction
      }
    ];

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${storedApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Błąd podczas komunikacji z OpenAI API.');
      }
      const data = await response.json();
      let jsonResponse = data.choices[0].message.content;
      jsonResponse = jsonResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const fields = JSON.parse(jsonResponse);
      if (!Array.isArray(fields)) {
        throw new Error('Odpowiedź API nie jest tablicą.');
      }
      setFieldsDefinition(fields);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Obsługa zmian w formularzu
  const handleFormFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  // Funkcja do generowania finalnego dokumentu HTML na podstawie opisu i danych z formularza
  const generateDocument = async () => {
    setError('');
    if (!storedApiKey) {
      setError('Brak klucza API OpenAI. Proszę wpisać klucz.');
      return;
    }
    setLoading(true);

    const instruction = `
Na podstawie poniższego opisu dokumentu formalnego:
"${documentPrompt}"
oraz następujących danych w formacie JSON:
${JSON.stringify(formData, null, 2)}
Wygeneruj kompletny dokument formalny w formacie HTML, odwzorowujący układ i formatowanie, który będzie gotowy do bezpośredniego renderowania w przeglądarce. Odpowiedź powinna zawierać wyłącznie czysty kod HTML.
    `;
    const messages = [
      {
        role: 'user',
        content: instruction
      }
    ];

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${storedApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Błąd podczas komunikacji z OpenAI API.');
      }
      const data = await response.json();
      let generatedHTML = data.choices[0].message.content;
      generatedHTML = generatedHTML.replace(/^```html\s*/, '').replace(/\s*```$/, '');
      setDocumentHtml(generatedHTML);
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Funkcja do pobierania wygenerowanego HTML
  const handleDownloadHTML = () => {
    if (!documentHtml) return;
    const filename = generateFilename(documentHtml) + '.html';
    const blob = new Blob([documentHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Funkcja do drukowania wygenerowanego HTML w nowym oknie
  const handlePrint = () => {
    if (!documentHtml) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(`
        <html>
          <head>
            <title>${generateFilename(documentHtml)}</title>
            <style>
              @media print { hr { page-break-after: always; } }
              body { font-family: Arial, sans-serif; margin: 20px; }
            </style>
          </head>
          <body>
            ${documentHtml}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.onload = () => { printWindow.print(); };
    }
  };

  // Funkcja resetująca wszystkie dane
  const resetGenerator = () => {
    setDocumentPrompt('');
    setFieldsDefinition(null);
    setFormData({});
    setDocumentHtml('');
    setStep(1);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Generator dokumentów
        </Typography>

        {/* Sekcja API Key */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6">Klucz API OpenAI</Typography>
          {storedApiKey ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
              <Typography variant="body1">Klucz zapisany.</Typography>
              <Button variant="outlined" color="error" onClick={handleApiKeyClear}>Wyloguj</Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
              <TextField label="Wprowadź klucz API" variant="outlined" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} fullWidth />
              <Button variant="contained" onClick={handleApiKeySave}>Zapisz</Button>
            </Box>
          )}
        </Box>

        {step === 1 && (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6">Opis dokumentu</Typography>
              <TextField
                label="Wprowadź opis dokumentu formalnego"
                variant="outlined"
                multiline
                rows={4}
                fullWidth
                value={documentPrompt}
                onChange={handleDocumentPromptChange}
              />
            </Box>
            <Box sx={{ mb: 3 }}>
              <Button variant="contained" color="primary" onClick={generateFields} disabled={loading} fullWidth>
                {loading ? <CircularProgress size={24} /> : 'Generuj definicję pól'}
              </Button>
            </Box>
          </>
        )}

        {step === 2 && fieldsDefinition && (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6">Wprowadź dane</Typography>
              <Grid container spacing={2}>
                {fieldsDefinition.map((field, index) => (
                  <Grid item xs={12} sm={6} key={index}>
                    <TextField
                      label={field.name}
                      variant="outlined"
                      fullWidth
                      type={field.type === 'date' ? 'date' : 'text'}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
            <Box sx={{ mb: 3 }}>
              <Button variant="contained" color="primary" onClick={generateDocument} disabled={loading} fullWidth>
                {loading ? <CircularProgress size={24} /> : 'Generuj dokument'}
              </Button>
            </Box>
          </>
        )}

        {step === 3 && (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Wynikowy kod HTML
              </Typography>
              <TextField variant="outlined" multiline rows={12} fullWidth value={documentHtml} InputProps={{ readOnly: true }} />
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Button variant="contained" fullWidth onClick={handleDownloadHTML}>
                  Pobierz .html
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button variant="contained" fullWidth onClick={handlePrint}>
                  Drukuj / Eksportuj
                </Button>
              </Grid>
            </Grid>
          </>
        )}

        {step !== 1 && (
          <Box sx={{ mt: 3 }}>
            <Button variant="outlined" color="secondary" fullWidth onClick={resetGenerator}>
              Wyczyść dane i zacznij od nowa
            </Button>
          </Box>
        )}

        {error && (
          <Box sx={{ mt: 3 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default App;