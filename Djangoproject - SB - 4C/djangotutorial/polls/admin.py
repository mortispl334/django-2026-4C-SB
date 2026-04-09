from django.contrib import admin

# Register your models here.
# from django.contrib.auth.models import User
# User.objects.filter(is_superuser=True).values_list('username',flat=True)
from .models import Question

admin.site.register(Question)
def was_published_recently(self):
    return self.pub_date >= timezone.now() - datetime.timedelta(days=1)

was_published_recently.boolean = True
was_published_recently.short_description = "Published recently?"