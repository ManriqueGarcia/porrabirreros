import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));

async function run() {
  const src = "porra-f1";
  const dest = "porra-f1-dev";
  console.log(`Copiando datos de ${src} a ${dest}...`);
  
  let lastKey = undefined;
  let count = 0;
  
  do {
    const res = await client.send(new ScanCommand({
      TableName: src,
      ExclusiveStartKey: lastKey
    }));
    
    for (const item of res.Items || []) {
      await client.send(new PutCommand({
        TableName: dest,
        Item: item
      }));
      count++;
      if (count % 10 === 0) console.log(`Copiados ${count} items...`);
    }
    
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  
  console.log(`Copia completada. Total items: ${count}`);
}

run().catch(console.error);