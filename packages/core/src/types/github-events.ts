/**
 * GitHub Webhook Event Types
 *
 * 참고: https://docs.github.com/en/webhooks/webhook-events-and-payloads
 */

export interface GithubUser {
  login: string
  id: number
  avatar_url: string
  type: string
}

export interface GithubRepository {
  id: number
  name: string
  full_name: string // owner/repo
  private: boolean
  html_url: string
}

export interface GithubPullRequest {
  number: number
  title: string
  html_url: string
  state: 'open' | 'closed'
  user: GithubUser
  base: {
    ref: string // base branch name
    repo: GithubRepository
  }
  head: {
    ref: string // head branch name
    repo: GithubRepository
  }
  requested_reviewers: GithubUser[]
}

export interface GithubReviewComment {
  id: number
  body: string
  user: GithubUser
  html_url: string
  created_at: string
}

export interface GithubReview {
  id: number
  user: GithubUser
  body: string | null
  state: 'approved' | 'changes_requested' | 'commented' | 'dismissed' | 'pending'
  submitted_at: string
  html_url: string
}

/**
 * pull_request_review_comment event
 * https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request_review_comment
 */
export interface PullRequestReviewCommentEvent {
  action: 'created' | 'edited' | 'deleted'
  comment: GithubReviewComment
  pull_request: GithubPullRequest
  repository: GithubRepository
  sender: GithubUser
}

/**
 * pull_request_review event
 * https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request_review
 */
export interface PullRequestReviewEvent {
  action: 'submitted' | 'edited' | 'dismissed'
  review: GithubReview
  pull_request: GithubPullRequest
  repository: GithubRepository
  sender: GithubUser
}

/**
 * 지원하는 GitHub 이벤트 타입
 */
export type SupportedGithubEvent =
  | { type: 'pull_request_review_comment'; payload: PullRequestReviewCommentEvent }
  | { type: 'pull_request_review'; payload: PullRequestReviewEvent }
