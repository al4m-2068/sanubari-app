import { twMerge } from "tailwind-merge"
import Button from "../components/atom/Button"
import { useSariAuthStore } from "../data/sariAuthStore"
import { NavLink, useParams } from "react-router"

const recentChatsClass = [
  'bg-th-moss',
  'bg-th-cream-pale',
  'bg-th-oak',
]  

function Chatbot() {
  const chats = useSariAuthStore(state => state.user.chatData)
  const recentChatsMeta = chats.slice(0, 3).map(({ topic, chatId }) => ({ topic, chatId }))
  return (
    <div className="flex flex-col items-center justify-center h-full pt-16 gap-9">
      <div className="flex flex-col items-center w-full px-6 text-center gap-11">
        <h1 className="text-4xl/[100%] font-medium font-cabinet">How can I help<br/>you today?</h1>
        <div className="relative flex items-center w-full">
          <input type="text" placeholder="Ask me something..." className="text-xs h-13 bg-th-plain-white border-[1.2px] border-th-plain-grey pl-6 pr-13 rounded-2xl w-full" />
          <Button className={'bg-th-green-dark size-9 rounded-xl justify-center text-white absolute right-2'}><i className="fi fi-sr-paper-plane-top text-base/[80%]"></i></Button>
        </div>
      </div>
      <div className="flex flex-col items-center w-full text-xs/[100%]">
        {recentChatsMeta.map(({ chatId, topic }, index) => (
          <NavLink key={chatId} className={twMerge('w-full flex justify-between p-4 h-19 -mb-7 rounded-2xl text-th-plain-black items-start', recentChatsClass[index % 3])} to={`/chatbot/${chatId}`}><span className="flex items-center justify-between w-full h-4">{topic} <i className="fi fi-rr-arrow-right text-base/[80%] text-th-plain-black/20"></i></span></NavLink>
        ))}
      </div>
      <div className="flex flex-col gap-8">
      </div>
    </div>
  )
}
export default Chatbot

export function ChatPage() {
  const { chatId } = useParams()
  const chats = useSariAuthStore(state => state.user.chatData)
  const chatMessages = chats.find(c => c.chatId == chatId).chatContent
  return (
    <div className="flex flex-col items-center w-full h-full pt-24 gap-9">
      <div className="flex flex-col w-full gap-10">
        {chatMessages.map(({ talkId, question, answer }) => (
          <div key={talkId} className="flex gap-10 flex-col w-full text-sm/[130%]">
            <div className="flex justify-end">
              <p className="w-[80%] rounded-2xl rounded-tr-none p-4 bg-th-green-light border-[1.2px] border-th-green-dark text-th-green-darker">{question}</p>
            </div>
            <div className="flex flex-col gap-6 text-th-plain-black">
                {answer.images !== null && 
                  <div className="flex items-center -space-x-1">
                    {answer.images?.map((img, index) => (
                      <img key={index} style={{rotate: answer.images?.length > 1 && `${['-5', '5'][index % 2]}deg`}} className="object-cover object-center size-24 rounded-3xl" src={img}/>
                    ))}
                  </div>
                }
              <p className="w-[80%]">{answer.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}