@content @files
Feature: Images and files
  As a tester of a site
  I want to upload a file to an image field, see it on the content and find it in the file listing
  So that images and files are covered

  # The image comes from tests/fixtures. The scenarios delete the content and
  # the file they create.

  Scenario: An image is uploaded to a post and shows on its page
    Given I am logged in as "admin"
    And the content "Post with an image from the suite" does not exist
    And the file "pixel.png" does not exist
    When I start a new "Post"
    And I enter "Post with an image from the suite" in the "Title" field
    Then the "Image" field should not hold the file "pixel.png"
    When I upload the file "pixel.png" to the "Image" field
    Then the "Image" field should hold the file "pixel.png"
    When I enter "A single pixel" in the "Alternate text" field
    And I save the content form
    Then the content on the page should show the image "pixel.png"
    And "article.node .field-type-image img" should have attribute "alt" with value "A single pixel"
    And the file "pixel.png" should exist
    When I delete the content "Post with an image from the suite"
    And the file "pixel.png" does not exist
    Then the file "pixel.png" should not exist
    And the content "Post with an image from the suite" should not exist

  Scenario: An uploaded file is removed from the field before saving
    Given I am logged in as "editor"
    When I start a new "Post"
    And I upload the file "pixel.png" to the "Image" field
    Then the "Image" field should hold the file "pixel.png"
    When I remove the file of the "Image" field
    Then the "Image" field should not hold the file "pixel.png"
    Given I am logged in as "admin"
    And the file "pixel.png" does not exist
    Then the file "pixel.png" should not exist

  Scenario: Content without an image shows none
    Given I am on "/posts/field-note-12"
    Then the content on the page should not show the image "pixel.png"

  Scenario: The file listing lists the files of the site
    Given I am logged in as "editor"
    Then the file "card1-layout.png" should exist
    And the file "no-such-file.png" should not exist
