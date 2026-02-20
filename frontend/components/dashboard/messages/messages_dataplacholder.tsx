// Placeholder data for the message feature
export interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
}

export interface Messages {
  id: string;
  message: string;
}

// placeholder for data if the user role is 'Client'
export const fakeConvo: Conversation[] = [
  { id: "1", name: "Pedro Guzman", lastMessage: "Hi there", timestamp: "2:30PM" },
  { id: "2", name: "Sam Moran", lastMessage: "Hello", timestamp: "2:45PM" },
  { id: "3", name: "Brendan Lyon", lastMessage: "How are you", timestamp: "5:00PM" },
  { id: "4", name: "Kabir Muzumdar", lastMessage: "", timestamp: "" },
  { id: "5", name: "Preston Vajdos", lastMessage: "", timestamp: "" },
  { id: "6", name: "Enoch Zhu", lastMessage: "", timestamp: "" },
  { id: "7", name: "Daniel Lam", lastMessage: "", timestamp: "" },
  { id: "8", name: "Dev Shroff", lastMessage: "", timestamp: "" },
  { id: "9", name: "Arianne Yude", lastMessage: "", timestamp: "" },
  { id: "10", name: "Christian Butler", lastMessage: "", timestamp: "" },
  { id: "11", name: "Alim Makanov", lastMessage: "", timestamp: "" },
];

// placeholder for data if the user role is 'Director'
export const fakeDirectorConvo: Conversation[] = [
  { id: "1", name: "Tesla", lastMessage: "I have an inquiry about the project", timestamp: "2:30PM" },
  { id: "2", name: "Elon Musk", lastMessage: "Our servers are down..", timestamp: "3:00PM" },
  { id: "3", name: "Jeff Bezos", lastMessage: "AWS servers are down", timestamp: "4:00PM" },
];

export function getConversationById(id: string) {
  return fakeConvo.find((c) => c.id === id);
}

export function getDirectorConversationById(id: string) {
  return fakeDirectorConvo.find((c) => c.id === id);
}