CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "mongo_user_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "preferred_currency" TEXT NOT NULL DEFAULT 'INR',
    "avatar_url" TEXT,
    "avatar_public_id" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "kyc_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "uploaded_files" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cloudinary_public_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secure_url" TEXT,
    "resource_type" TEXT NOT NULL DEFAULT 'image',
    "format" TEXT,
    "bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "folder" TEXT,
    "original_name" TEXT,
    "mime_type" TEXT,
    "upload_type" TEXT NOT NULL DEFAULT 'profile_avatar',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_mongo_user_id_key" ON "users"("mongo_user_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "uploaded_files_cloudinary_public_id_key" ON "uploaded_files"("cloudinary_public_id");
CREATE INDEX "uploaded_files_user_id_idx" ON "uploaded_files"("user_id");
CREATE INDEX "uploaded_files_upload_type_idx" ON "uploaded_files"("upload_type");

ALTER TABLE "uploaded_files"
ADD CONSTRAINT "uploaded_files_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
