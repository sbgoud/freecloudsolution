import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '@/context/TelegramContext';
import { humanSize, listAll, uploadFiles, DriveFile } from '@/lib/telegram/files';
import { joinPath } from '@/lib/telegram/meta';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import FileUpload from '@/components/ui/file-upload';
import { useToast } from '@/hooks/use-toast';

const Home = () => {
  const navigate = useNavigate();
  const { client, status, logout } = useTelegram();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const isLoggedIn = status === 'loggedIn';

  useEffect(() => {
    if (status === 'loggedOut') {
      navigate('/login');
    }
  }, [status, navigate]);

  const loadMessages = async () => {
    if (!client) return;
    setIsLoading(true);
    try {
      const result = await listAll(client);
      setFiles(result.files);
    } catch (error) {
      console.error('Failed to load messages', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    void logout().then(() => navigate('/login'));
  };

  useEffect(() => {
    if (isLoggedIn && client) {
      loadMessages();
    }
  }, [isLoggedIn, client]);

  const handleFileSelect = (selected: File[]) => {
    console.log('Files selected:', selected.map(f => f.name));
  };

  const handleFileUpload = async (selected: File[]) => {
    if (!client) {
      throw new Error('Telegram client is not ready');
    }

    try {
      const items = selected.map((file) => ({
        file,
        path: joinPath('/Unsorted', file.name),
      }));

      await uploadFiles(client, items, {
        onFileProgress: (fileIndex, fraction) => {
          console.log(`File ${fileIndex + 1} progress: ${Math.round(fraction * 100)}%`);
        },
      });

      toast({
        title: 'Files uploaded successfully!',
        description: `${selected.length} file${selected.length === 1 ? '' : 's'} have been saved to your Telegram messages.`,
      });

      await loadMessages();
    } catch (error: unknown) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description:
          error instanceof Error
            ? error.message
            : 'There was an error uploading your files. Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleFileError = (error: string) => {
    toast({
      title: 'File validation error',
      description: error,
      variant: 'destructive',
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Saved Messages</h1>
          <div className="space-x-2">
            <Button onClick={loadMessages} disabled={isLoading}>
              Refresh
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : files.length > 0 ? (
          <div className="space-y-4">
            {files.map((file) => (
              <Card key={file.id}>
                <CardHeader>
                  <CardTitle>{file.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{file.path}</p>
                  <p className="text-sm text-gray-500">{humanSize(file.size)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p>No files found.</p>
        )}

        {/* File Upload Section */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Upload File to Saved Messages</h2>
          <FileUpload
            onFileSelect={handleFileSelect}
            onUpload={handleFileUpload}
            onError={handleFileError}
            maxSizeInMB={4096}
            acceptedTypes={[]}
          />
        </div>
      </div>
    </div>
  );
};

export default Home;
