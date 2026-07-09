-- Allow a task to tag additional collaborators alongside the single assignee.
-- Used by the creative pipeline: the editor is the assignee, the media buyer
-- (and any other collaborators) are tagged so they see the task too.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS collaborator_ids UUID[] NOT NULL DEFAULT '{}';
