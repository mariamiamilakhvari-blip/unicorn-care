import mongoose, { InferSchemaType, Schema } from 'mongoose';

/**
 * An uploaded file's record. The bytes live in Vercel Blob; this row is the index over them.
 *
 * Two stores means two things can disagree, so the ordering is fixed everywhere: the blob is
 * written before the row and deleted after it. An orphaned blob costs storage and nothing else;
 * a row pointing at a blob that is gone is a broken image in the console with no way to clear it.
 *
 * Nothing here is patient data. Post-operative photos are specced in PRD 06 §3 and need private
 * storage, signed short-lived URLs, per-upload consent and access logging — none of which this
 * has. `url` is a public Blob URL: anyone holding it can read the file, so nothing clinical may
 * be uploaded through this route.
 */
const FileSchema = new Schema(
  {
    name: { type: String, required: true },
    /** Blob's own pathname, which is what a delete is addressed by. */
    pathname: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// The console lists newest first.
FileSchema.index({ createdAt: -1 });

export type FileDocument = InferSchemaType<typeof FileSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const FileModel = mongoose.models.File || mongoose.model('File', FileSchema);
