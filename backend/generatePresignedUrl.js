// generatePresignedUrl.js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const dotenv = require("dotenv");

dotenv.config();

const s3Client = new S3Client({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  const { fileName, fileType } = JSON.parse(event.body);

  try {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      ContentType: fileType,
    });

    // Generate a pre-signed URL valid for 15 minutes
    const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return {
      statusCode: 200,
      body: JSON.stringify({ url }),
    };
  } catch (error) {
    console.error("Error generating pre-signed URL:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error generating pre-signed URL" }),
    };
  }
};
