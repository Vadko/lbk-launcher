export interface GameReviewReply {
  id: string;
  text: string;
  createdAt: string;
}

export interface GameReview {
  id: string;
  text: string;
  createdAt: string;
  images: string[];
  replies: GameReviewReply[];
}

export interface GameReviewsPage {
  items: GameReview[];
  total: number;
  pageSize: number;
}
