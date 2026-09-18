import mongoose, { Schema, Document, Model } from "mongoose";

export interface IActiveVideo {
  type: "youtube";
  videoId?: string; // YouTube video ID
  duration?: number;
}

export interface IRoom extends Document {
  code: string;
  persistentSlug?: string;
  hostId: string;
  participants: string[];
  activeVideo?: IActiveVideo;
  status: "active" | "closed";
  createdAt: Date;
  updatedAt: Date;
}

const ActiveVideoSchema = new Schema<IActiveVideo>(
  {
    type: {
      type: String,
      enum: ["youtube"],
      default: "youtube",
      required: true,
    },
    videoId: {
      type: String,
      trim: true,
    },
    duration: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const RoomSchema = new Schema<IRoom>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    persistentSlug: {
      type: String,
      trim: true,
      sparse: true,
    },
    hostId: {
      type: String,
      required: true,
      trim: true,
    },
    participants: {
      type: [String],
      default: [],
    },
    activeVideo: {
      type: ActiveVideoSchema,
      required: false,
    },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Prevent mongoose model overwrite in hot reload environments
export const Room: Model<IRoom> =
  mongoose.models.Room || mongoose.model<IRoom>("Room", RoomSchema);
