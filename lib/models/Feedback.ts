import mongoose, { Schema, Document, Model } from "mongoose";

export type FeedbackCategory = "bug" | "sync" | "audio" | "feature" | "other";

export interface IFeedback extends Document {
  category: FeedbackCategory;
  message: string;
  email?: string;
  roomCode?: string;
  videoId?: string;
  userAgent?: string;
  screenResolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    category: {
      type: String,
      enum: ["bug", "sync", "audio", "feature", "other"],
      default: "bug",
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    roomCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    videoId: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    screenResolution: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Feedback: Model<IFeedback> =
  mongoose.models.Feedback || mongoose.model<IFeedback>("Feedback", FeedbackSchema);
