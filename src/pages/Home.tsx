import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '@/context/TelegramContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import FileUpload from '@/components/ui/file-upload';
import { useToast } from '@/hooks/use-toast';

const Home = () => {
  const navigate = useNavigate();
  const { isLoggedIn, fetchMessages, logout, uploadFile } = useTelegram();
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Redirect to login if not logged in
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const msgs = await fetchMessages();
      setMessages(msgs);
    } catch (error) {
      console.error('Failed to load messages', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadMessages();
    }
  }, [isLoggedIn]);

  const handleFileSelect = (file: File) => {
    console.log('File selected:', file.name);
  };

  const handleFileUpload = async (file: File) => {
    try {
      await uploadFile(file);
      toast({
        title: "File uploaded successfully!",
        description: `${file.name} has been saved to your Telegram messages.`,
      });
      // Refresh messages to show the newly uploaded file
      await loadMessages();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "There was an error uploading your file. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleFileError = (error: string) => {
    toast({
      title: "File validation error",
      description: error,
      variant: "destructive",
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
        ) : messages.length > 0 ? (
          <div className="space-y-4">
            {messages.map((msg) => (
              <Card key={msg.id}>
                <CardHeader>
                  <CardTitle>Message {msg.id}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{msg.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p>No messages found.</p>
        )}

        {/* File Upload Section */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Upload File to Saved Messages</h2>
          <FileUpload
            onFileSelect={handleFileSelect}
            onUpload={handleFileUpload}
            onError={handleFileError}
            maxSizeInMB={2048} // 2GB = 2048MB
            acceptedTypes={[]} // Allow all file types
          />
        </div>
      </div>
    </div>
  );
};

export default Home;