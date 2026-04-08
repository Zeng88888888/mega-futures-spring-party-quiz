const projectRef = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectRef || !token) {
  throw new Error("Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN.");
}

const repairedRows = [
  {
    id: "9f89febf-6bb8-47be-87ad-5dc807582395",
    content: "下列哪一項最符合兆豐期貨春酒競賽系統中的玩家唯一識別欄位？",
    optionA: "暱稱",
    optionB: "部門",
    optionC: "員編",
    optionD: "手機號碼",
    correctOption: "C",
    explanation: "同一場次以員編作為唯一識別，避免重複報名與排行錯誤。"
  },
  {
    id: "e008b318-65ad-4c01-bea2-0b55b45d16c5",
    content: "淘汰賽中玩家送出答案後，系統應立即顯示 still alive 嗎？",
    optionA: "要，讓玩家安心",
    optionB: "不要，避免隔壁偷看",
    optionC: "只顯示給主持人",
    optionD: "只顯示給前十名",
    correctOption: "B",
    explanation: "淘汰賽送出後只顯示等待公布，主持人公布結果後才統一揭曉。"
  },
  {
    id: "15dd1a20-c812-4258-be82-f15b6bd84ec0",
    content: "競賽模式中，每題預設作答時間為幾秒？",
    optionA: "5 秒",
    optionB: "8 秒",
    optionC: "10 秒",
    optionD: "15 秒",
    correctOption: "C",
    explanation: "目前規格為競賽模式每題限時 10 秒。"
  },
  {
    id: "27c640a8-753d-4f91-8be3-27a039fbf322",
    content: "競賽模式中，答錯一題會如何計分？",
    optionA: "倒扣 10 分",
    optionB: "0 分",
    optionC: "保底 10 分",
    optionD: "扣除總秒數",
    correctOption: "B",
    explanation: "競賽模式答錯為 0 分，不倒扣。"
  },
  {
    id: "2d350ac0-f909-41cc-b2a8-09b42049012d",
    content: "淘汰賽中，未作答的玩家會如何處理？",
    optionA: "保留到下一輪",
    optionB: "0 分但不淘汰",
    optionC: "直接淘汰",
    optionD: "主持人手動決定",
    correctOption: "C",
    explanation: "淘汰賽規則是未作答視為淘汰。"
  },
  {
    id: "491e405d-74b7-4331-9bc6-244df4cc236a",
    content: "競賽模式排行榜的主要排序依據是什麼？",
    optionA: "部門",
    optionB: "總分",
    optionC: "最晚加入時間",
    optionD: "員編大小",
    correctOption: "B",
    explanation: "競賽模式先比總分，同分再比總作答時間。"
  },
  {
    id: "c8826d14-d8d8-4330-b328-9be7883d3827",
    content: "被主持人標記為無效的玩家，是否還會列入排行榜？",
    optionA: "會",
    optionB: "只在最終榜單出現",
    optionC: "不會",
    optionD: "只在淘汰賽會出現",
    correctOption: "C",
    explanation: "無效玩家會完全排除於排行榜、淘汰統計與得獎名單。"
  },
  {
    id: "cdd44a28-de45-4743-880a-bbf07d0f98c8",
    content: "淘汰賽會在什麼條件下直接結束？",
    optionA: "主持人手動停止",
    optionB: "剩餘玩家小於或等於 10 人",
    optionC: "答完第 5 題",
    optionD: "每人至少淘汰一次",
    correctOption: "B",
    explanation: "淘汰賽當剩餘有效存活玩家小於或等於 10 人時直接結束。"
  },
  {
    id: "d3160aa8-7797-4e9b-9009-78cda8049b6c",
    content: "主持人公布結果後，淘汰賽答對的玩家會看到什麼？",
    optionA: "恭喜得分 100",
    optionB: "still alive",
    optionC: "下一題開始",
    optionD: "排名第幾名",
    correctOption: "B",
    explanation: "淘汰賽揭曉後，答對玩家顯示 still alive。"
  },
  {
    id: "fdc690db-d700-427b-bbf6-b506b56c5c8c",
    content: "競賽模式中，越快答對的玩家會有什麼效果？",
    optionA: "分數越高",
    optionB: "題目越少",
    optionC: "部門加分",
    optionD: "直接進前十",
    correctOption: "A",
    explanation: "競賽模式採速度加分，越快答對越接近 100 分。"
  }
];

const duplicateBrokenIds = [
  "3879744f-b9a6-417f-8356-94a7db67660f",
  "215d3ed9-ddd3-4efe-a8b3-b3fe6a6f9ffa",
  "ad2e88f2-91ac-4833-8dff-28a4696eca47",
  "aa3afd8c-eea5-414a-bf80-b8b007fddb96",
  "3f2a7b37-3b4e-4514-94a3-f9720d1a04f7",
  "87149182-54a5-4ba5-861a-d5d26484e406",
  "31f7aade-173e-4b93-9027-35a911f10047",
  "d7cd1582-7ea2-49b0-a2ee-8c42d5ab5d3d",
  "d54644e3-1b41-4832-ae55-ac6d8cd89e09",
  "f3e2ab3b-9738-4264-8fcf-e6bcbbe58075"
];

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

const statements = [
  "update public.games set title = '兆豐期貨春酒活動' where join_code = 'MEGA2026';"
];

for (const row of repairedRows) {
  statements.push(
    `update public.questions set content='${escapeSql(row.content)}', option_a='${escapeSql(
      row.optionA
    )}', option_b='${escapeSql(row.optionB)}', option_c='${escapeSql(row.optionC)}', option_d='${escapeSql(
      row.optionD
    )}', correct_option='${escapeSql(row.correctOption)}', explanation='${escapeSql(
      row.explanation
    )}' where id='${row.id}';`
  );
}

statements.push(
  `delete from public.questions where id in (${duplicateBrokenIds.map((id) => `'${id}'`).join(", ")});`
);

const query = statements.join("\n");

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ query })
});

if (!response.ok) {
  throw new Error(await response.text());
}

console.log("Repair completed.");
