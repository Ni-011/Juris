import { db } from "../src/lib/db";
import { users, chatSessions, chatMessages } from "../src/drizzle/schema";
import { eq } from "drizzle-orm";

async function populateFakeData() {
  const email = "nitinrana01125532553@gmail.com";
  
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (!user) {
    console.error("User not found!");
    process.exit(1);
  }

  console.log(`Populating data for user: ${user.id} (${email})`);

  const sessionsData = [
    {
      title: "Analysis of Section 498A IPC",
      messages: [
        { role: "user", content: "Can you explain the recent amendments to Section 498A of the IPC?" },
        { role: "assistant", content: "Section 498A of the IPC deals with matrimonial cruelty. Recent judicial guidelines, particularly in cases like *Arnesh Kumar v. State of Bihar*, emphasize that arrests should not be automatic. The police must follow Section 41A of the CrPC." }
      ]
    },
    {
      title: "Contract Law: Force Majeure in India",
      messages: [
        { role: "user", content: "What is the legal status of Force Majeure clauses in Indian contracts post-COVID?" },
        { role: "assistant", content: "In India, Force Majeure is governed by Sections 32 and 56 of the Indian Contract Act, 1872. The Supreme Court in *Satyabrata Ghose v. Mugneeram Bangur & Co.* established the doctrine of frustration." }
      ]
    },
    {
      title: "Consumer Protection Act 2019 Overview",
      messages: [
        { role: "user", content: "What are the key changes in the Consumer Protection Act 2019 compared to the 1986 Act?" },
        { role: "assistant", content: "The 2019 Act introduced the Central Consumer Protection Authority (CCPA), rules for e-commerce, and enhanced pecuniary jurisdiction for consumer commissions at various levels." }
      ]
    }
  ];

  for (const sessionData of sessionsData) {
    const [session] = await db.insert(chatSessions).values({
      tenantId: user.authId,
      title: sessionData.title,
    }).returning();

    for (const msg of sessionData.messages) {
      await db.insert(chatMessages).values({
        sessionId: session.id,
        tenantId: user.authId,
        role: msg.role as any,
        content: msg.content,
      });
    }
    console.log(`Created session: ${sessionData.title}`);
  }

  console.log("Done!");
  process.exit(0);
}

populateFakeData().catch(console.error);
