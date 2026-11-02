-- The realistic picture of a shared quilt, made in the owner's browser. It belongs to the quilt as it was when the
-- picture was made: sharing a changed quilt drops it until the new one arrives.
alter table shared_designs
  add column picture_key text,          -- where the picture lives in object storage (none yet: null)
  add column picture_upload_key text;   -- a new upload's place, until it has been checked
