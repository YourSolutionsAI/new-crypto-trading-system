'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          Ein Fehler ist aufgetreten
        </h2>
        <div className="bg-gray-100 p-4 rounded mb-4">
          <p className="text-sm font-mono text-gray-800 break-all">
            {error.message || 'Unbekannter Fehler'}
          </p>
        </div>
        <div className="space-y-2 mb-4">
          <p className="text-sm text-gray-600">
            <strong>Mögliche Ursachen:</strong>
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>Umgebungsvariable NEXT_PUBLIC_API_URL nicht gesetzt</li>
            <li>Backend nicht erreichbar</li>
            <li>CORS-Fehler</li>
          </ul>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={reset}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Erneut versuchen
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Seite neu laden
          </button>
        </div>
      </div>
    </div>
  );
}

