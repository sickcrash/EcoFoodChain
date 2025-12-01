import { useLocation, useNavigate } from "react-router-dom";
import ChatbotImg from "../../pages/chatbot/public/ChatbotIcon.png";

// Chatbot component che mostra il pulsante per accedere alla chat
export const ChatbotIcon = (): JSX.Element | null => {
  const navigate = useNavigate();
  const location = useLocation();

  // Se siamo sulla pagina chatbot, il pulsante scompare
  const isChatbotPage = location.pathname.includes("/chatbot");
  const pathParts = location.pathname.split('/');
  const company = pathParts[1];
  const device = pathParts[2];

  const goToChatbot = () => navigate(`/chatbot/${company}/${device}`);


  if (isChatbotPage) return null;

  return (
    <div className="pt-2">
      <button
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-lg bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center hover:scale-110 transition-transform duration-300 border-2 border-white"
        onClick={goToChatbot}
      >
        <img src={ChatbotImg} alt="Icona" className="w-10 h-10 object-contain rounded-full" />
      </button>
    </div>
  );
};

