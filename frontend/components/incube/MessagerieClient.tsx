"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Send, AlertCircle, MessageSquare, CheckCheck } from "lucide-react";

type Mentor = { id: string; first_name: string; last_name: string; email: string };
type Message = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string; is_read?: boolean };
export default function MessagerieClient({ 
  mentor, 
  initialMessages, 
  incubeId 
}: { 
  mentor: Mentor | null, 
  initialMessages: Message[], 
  incubeId: string 
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas quand un message est ajouté
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Abonnement Temps Réel (Supabase Realtime)
  useEffect(() => {
    if (!mentor) return;

    const channel = supabase
      .channel("chat-incube-mentor")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          // Si le message nous concerne (soit envoyé par nous, soit par le mentor)
          if (
            (newMsg.sender_id === incubeId && newMsg.receiver_id === mentor.id) ||
            (newMsg.sender_id === mentor.id && newMsg.receiver_id === incubeId)
          ) {
            setMessages((prev) => {
              // Évite les doublons si on a déjà ajouté le message localement
              if (prev.find((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, is_read: updated.is_read } : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mentor, incubeId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !mentor || isSending) return;

    const messageContent = newMessage.trim();
    setNewMessage(""); // Vide l'input immédiatement pour l'UX
    setIsSending(true);

    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: incubeId,
        receiver_id: mentor.id,
        content: messageContent,
        is_read: false
      });
if (error) throw error;
      // Le temps réel Supabase insère directement le vrai message sans doublon
    } catch (error) {
     console.error("Détail réel erreur message:", (error as any)?.message || JSON.stringify(error));
      alert("Impossible d'envoyer le message.");
      setNewMessage(messageContent); // Remet le texte en cas d'erreur
    } finally {
      setIsSending(false);
    }
  };

  if (!mentor) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-[#e7edf3] text-center mt-6 shadow-sm">
        <AlertCircle size={40} className="mx-auto text-[#758396] mb-4" />
        <h2 className="text-xl font-bold text-[#081e2c]">Aucun mentor assigné</h2>
        <p className="text-[#758396] mt-2 font-medium">La messagerie sera activée dès qu'un mentor vous sera attribué.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e7edf3] shadow-sm flex flex-col h-[70vh] max-h-[800px] overflow-hidden">
      {/* En-tête du Chat */}
      <div className="px-6 py-4 border-b border-[#e7edf3] bg-[#f4f6fb] flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-[#081e2c] flex items-center justify-center text-white font-bold text-sm relative">
          {mentor.first_name.charAt(0)}{mentor.last_name.charAt(0)}
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#f4f6fb] rounded-full"></span>
        </div>
        <div>
          <h2 className="text-sm font-bold text-[#081e2c]">{mentor.first_name} {mentor.last_name}</h2>
          <p className="text-xs text-[#087f71] font-semibold">Mentor assigné</p>
        </div>
      </div>

      {/* Zone des messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <MessageSquare size={48} className="text-[#758396] mb-4" />
            <p className="text-[#081e2c] font-bold">Démarrez la conversation</p>
            <p className="text-[#758396] text-sm">Posez vos questions à {mentor.first_name}.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === incubeId;
            const time = new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div 
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-medium ${
                    isMe 
                      ? 'bg-[#087f71] text-white rounded-br-sm' // Bulles Incubé (Teal)
                      : 'bg-[#f4f6fb] text-[#081e2c] border border-[#e7edf3] rounded-bl-sm' // Bulles Mentor (Gris)
                  }`}
                >
                  {msg.content}
                </div>
                <div className="flex items-center gap-1 mt-1 mx-1">
                  <span className="text-[10px] text-[#758396] font-semibold">
                    {time}
                  </span>
                  {isMe && (
                    <CheckCheck 
                      size={14} 
                      className={msg.is_read ? "text-red-500" : "text-[#758396]/50"} 
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input / Formulaire d'envoi */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-[#e7edf3] flex items-center gap-3">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Écrivez votre message..."
          disabled={isSending}
          className="flex-1 bg-[#f4f6fb] border border-[#e7edf3] rounded-xl px-4 py-3 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71] focus:ring-1 focus:ring-[#087f71] transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || isSending}
          className="bg-[#081e2c] hover:bg-[#172538] text-white p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}