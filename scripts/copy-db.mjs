import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" }));

async function run() {
  const src = process.env.DYNAMODB_TABLE_SRC || "PorraBirreros";
  const dest = process.env.DYNAMODB_TABLE_DEST || "PorraBirreros-dev";
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